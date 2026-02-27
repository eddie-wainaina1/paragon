import { useEffect, useRef } from 'react';
import Hls from 'hls.js';
import { useAuthStore } from '@/store/authStore';

interface Props {
  contentId: string;
}

export default function HlsAudioPlayer({ contentId }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const hlsRef   = useRef<Hls | null>(null);
  const token    = useAuthStore((s) => s.token);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !token) return;

    const src = `/api/v1/content/${contentId}/hls/audio.m3u8`;

    hlsRef.current?.destroy();
    hlsRef.current = null;

    if (Hls.isSupported()) {
      const hls = new Hls({
        xhrSetup: (xhr) => {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        },
      });
      hls.loadSource(src);
      hls.attachMedia(audio);
      hlsRef.current = hls;
    }

    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [contentId, token]);

  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption
    <audio
      ref={audioRef}
      controls
      controlsList="nodownload"
      onContextMenu={(e) => e.preventDefault()}
      style={{ width: '100%' }}
    />
  );
}
