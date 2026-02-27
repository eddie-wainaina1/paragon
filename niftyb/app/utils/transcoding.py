"""Async HLS transcoding using ffmpeg-python.

Produces two quality levels (720p + 360p) in a temporary directory, stores
each segment and playlist in GridFS, then marks the Content document as ready.
"""

import asyncio
import logging
import os
import tempfile

import ffmpeg

from app.db import gridfs_put
from app.models.content import Content

logger = logging.getLogger(__name__)

_QUALITIES = [
    ("720p", 720, "2800k", "128k"),
    ("360p", 360, "800k",  "96k"),
]

_AUDIO_BITRATE = "128k"


async def transcode_audio_to_hls(content_id: str, file_data: bytes) -> None:
    """Transcode audio to HLS segments and store results in GridFS."""
    try:
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, _transcode_audio_sync, content_id, file_data)
    except Exception as exc:
        logger.error("[%s] Audio transcoding background task failed: %s", content_id, exc, exc_info=True)


def _transcode_audio_sync(content_id: str, file_data: bytes) -> None:
    logger.info("[%s] Audio HLS transcoding started (input: %d bytes)", content_id, len(file_data))

    with tempfile.TemporaryDirectory() as tmpdir:
        input_path = os.path.join(tmpdir, "input_audio")
        with open(input_path, "wb") as f:
            f.write(file_data)

        try:
            (
                ffmpeg
                .input(input_path)
                .output(
                    os.path.join(tmpdir, "audio.m3u8"),
                    acodec="aac",
                    hls_time=6,
                    hls_playlist_type="vod",
                    hls_segment_filename=os.path.join(tmpdir, "audio_%03d.ts"),
                    format="hls",
                    **{"b:a": _AUDIO_BITRATE},
                )
                .overwrite_output()
                .run(quiet=True)
            )
            logger.info("[%s] Audio FFmpeg pass done", content_id)
        except FileNotFoundError:
            logger.error(
                "[%s] FFmpeg binary not found — install ffmpeg",
                content_id,
            )
            return
        except ffmpeg.Error as exc:
            stderr = exc.stderr.decode(errors="replace")[:500] if exc.stderr else ""
            logger.error("[%s] Audio FFmpeg pass failed: %s", content_id, stderr)
            return

        hls_files: dict[str, str] = {}
        for fname in sorted(os.listdir(tmpdir)):
            if not fname.startswith("audio"):
                continue
            fpath = os.path.join(tmpdir, fname)
            if not os.path.isfile(fpath):
                continue
            mime = "application/x-mpegURL" if fname.endswith(".m3u8") else "video/mp2t"
            with open(fpath, "rb") as f:
                data = f.read()
            oid = gridfs_put(data, fname, mime)
            hls_files[fname] = str(oid)

        logger.info("[%s] Stored %d audio HLS files in GridFS", content_id, len(hls_files))

        content = Content.get_by_id(content_id)
        if content:
            content.hls_ready = True
            content.hls_files = hls_files
            content.save()
            logger.info("[%s] Audio HLS ready — %d files", content_id, len(hls_files))
        else:
            logger.warning("[%s] Content not found after audio transcoding — HLS files discarded", content_id)


async def transcode_to_hls(content_id: str, file_data: bytes) -> None:
    """Transcode *file_data* to HLS and store results in GridFS.

    Runs the synchronous FFmpeg work in a thread-pool executor so it does not
    block the FastAPI event loop.
    """
    try:
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, _transcode_sync, content_id, file_data)
    except Exception as exc:
        logger.error("[%s] Transcoding background task failed: %s", content_id, exc, exc_info=True)


def _transcode_sync(content_id: str, file_data: bytes) -> None:
    logger.info("[%s] HLS transcoding started (input: %d bytes)", content_id, len(file_data))

    with tempfile.TemporaryDirectory() as tmpdir:
        input_path = os.path.join(tmpdir, "input_video")
        with open(input_path, "wb") as f:
            f.write(file_data)

        hls_files: dict[str, str] = {}
        completed: list[str] = []

        for label, height, vbr, abr in _QUALITIES:
            logger.info("[%s] FFmpeg pass starting: %s (%s video, %s audio)", content_id, label, vbr, abr)
            try:
                (
                    ffmpeg
                    .input(input_path)
                    .output(
                        os.path.join(tmpdir, f"{label}.m3u8"),
                        vf=f"scale=-2:{height}",
                        vcodec="libx264",
                        preset="fast",
                        acodec="aac",
                        hls_time=6,
                        hls_playlist_type="vod",
                        hls_segment_filename=os.path.join(tmpdir, f"{label}_%03d.ts"),
                        format="hls",
                        **{"b:v": vbr, "b:a": abr},
                    )
                    .overwrite_output()
                    .run(quiet=True)
                )
                completed.append(label)
                logger.info("[%s] FFmpeg pass done: %s", content_id, label)
            except FileNotFoundError:
                logger.error(
                    "[%s] FFmpeg binary not found — install ffmpeg (e.g. `brew install ffmpeg` or `apt-get install ffmpeg`)",
                    content_id,
                )
                return
            except ffmpeg.Error as exc:
                stderr = exc.stderr.decode(errors="replace")[:500] if exc.stderr else ""
                logger.error("[%s] FFmpeg pass failed: %s — %s", content_id, label, stderr)
                continue

            # Collect the files produced by this pass
            segment_count = 0
            for fname in sorted(os.listdir(tmpdir)):
                if not fname.startswith(label):
                    continue
                fpath = os.path.join(tmpdir, fname)
                if not os.path.isfile(fpath):
                    continue
                mime = "application/x-mpegURL" if fname.endswith(".m3u8") else "video/mp2t"
                with open(fpath, "rb") as f:
                    data = f.read()
                oid = gridfs_put(data, fname, mime)
                hls_files[fname] = str(oid)
                segment_count += 1
            logger.info("[%s] Stored %d files in GridFS for %s", content_id, segment_count, label)

        if not completed:
            logger.error("[%s] All FFmpeg passes failed — HLS not created", content_id)
            return

        # Build and store the master playlist
        logger.info("[%s] Building master playlist (qualities: %s)", content_id, ", ".join(completed))
        master_lines = ["#EXTM3U", "#EXT-X-VERSION:3"]
        if "720p" in completed:
            master_lines += ["#EXT-X-STREAM-INF:BANDWIDTH=2928000,RESOLUTION=1280x720", "720p.m3u8"]
        if "360p" in completed:
            master_lines += ["#EXT-X-STREAM-INF:BANDWIDTH=896000,RESOLUTION=640x360", "360p.m3u8"]
        master_data = ("\n".join(master_lines) + "\n").encode()
        master_oid = gridfs_put(master_data, "master.m3u8", "application/x-mpegURL")
        hls_files["master.m3u8"] = str(master_oid)

        content = Content.get_by_id(content_id)
        if content:
            content.hls_ready = True
            content.hls_files = hls_files
            content.save()
            logger.info("[%s] HLS ready — %d total files in GridFS", content_id, len(hls_files))
        else:
            logger.warning("[%s] Content not found after transcoding — HLS files discarded", content_id)
