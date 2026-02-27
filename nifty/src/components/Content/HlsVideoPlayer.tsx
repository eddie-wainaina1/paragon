import { useEffect, useRef } from 'react';
import Hls from 'hls.js';
import { useAuthStore } from '@/store/authStore';

interface Props {
  contentId: string;
}

export default function HlsVideoPlayer({ contentId }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef   = useRef<Hls | null>(null);
  const token    = useAuthStore((s) => s.token);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !token) return;

    const src = `/api/v1/content/${contentId}/hls/master.m3u8`;

    hlsRef.current?.destroy();
    hlsRef.current = null;

    if (Hls.isSupported()) {
      const hls = new Hls({
        xhrSetup: (xhr) => {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        },
      });
      hls.loadSource(src);
      hls.attachMedia(video);
      hlsRef.current = hls;
    }

    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [contentId, token]);

  return (
    <video
      ref={videoRef}
      controls
      controlsList="nodownload"
      disablePictureInPicture
      onContextMenu={(e) => e.preventDefault()}
      style={{ width: '100%', maxHeight: 440, display: 'block' }}
    />
  );
}
