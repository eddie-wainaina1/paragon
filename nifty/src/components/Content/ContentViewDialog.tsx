import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  Chip,
  IconButton,
  Divider,
  CircularProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import Hls from 'hls.js';
import { useQuery } from '@tanstack/react-query';
import { contentApi } from '@/api/content';
import HlsVideoPlayer from './HlsVideoPlayer';
import HlsAudioPlayer from './HlsAudioPlayer';
import PdfViewer from './PdfViewer';

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1';

const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  text:  { bg: '#DBEAFE', color: '#1D4ED8' },
  video: { bg: '#FCE7F3', color: '#BE185D' },
  audio: { bg: '#D1FAE5', color: '#065F46' },
  pdf:   { bg: '#FEF3C7', color: '#92400E' },
};

const THUMB_GRADIENTS: Record<string, string> = {
  text:  'linear-gradient(135deg,#DBEAFE,#EFF6FF)',
  video: 'linear-gradient(135deg,#FCE7F3,#FDF2F8)',
  audio: 'linear-gradient(135deg,#D1FAE5,#ECFDF5)',
  pdf:   'linear-gradient(135deg,#FEF3C7,#FFFBEB)',
};

interface Props {
  contentId: string | null;
  onClose: () => void;
}

export default function ContentViewDialog({ contentId, onClose }: Props) {
  const open = !!contentId;

  // GET /content/{id} increments the view counter on the backend
  const { data: content, isLoading } = useQuery({
    queryKey: ['content', contentId],
    queryFn: () => contentApi.get(contentId!),
    enabled: open,
  });

  // File token only needed for PDF (audio and video both use HLS)
  const needsFileToken = open && !!content?.file_id && content.type === 'pdf';
  const { data: fileToken, isLoading: isTokenLoading } = useQuery({
    queryKey: ['content-file-token', contentId],
    queryFn: () => contentApi.getFileToken(contentId!),
    enabled: needsFileToken,
    staleTime: 25 * 60 * 1000,
  });

  // Stream URL used only by audio and PDF
  const streamUrl = content?.file_id && fileToken
    ? `${BASE_URL}/content/${content.id}/file?token=${encodeURIComponent(fileToken)}`
    : null;

  const isVideo = content?.type === 'video';
  const isAudio = content?.type === 'audio';
  const isPdf = content?.type === 'pdf';
  const typeColor = content ? (TYPE_COLORS[content.type] ?? TYPE_COLORS.text) : TYPE_COLORS.text;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={isVideo || isPdf ? 'md' : 'sm'}
      fullWidth
      PaperProps={{ sx: { borderRadius: 4, border: '2px solid', borderColor: 'divider' } }}
    >
      <DialogContent sx={{ p: 0 }}>

        {/* ── Video: full-width dark player at top ── */}
        {isVideo && (
          <Box
            sx={{
              background: '#0d0d0d',
              position: 'relative',
              borderRadius: '16px 16px 0 0',
              overflow: 'hidden',
              minHeight: 240,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isLoading ? (
              <CircularProgress sx={{ color: 'rgba(255,255,255,0.6)' }} />
            ) : content?.hls_ready && Hls.isSupported() ? (
              <HlsVideoPlayer contentId={content.id} />
            ) : content?.file_id && !content.hls_ready ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <CircularProgress size={32} sx={{ color: 'rgba(255,255,255,0.6)', mb: 1.5, display: 'block', mx: 'auto' }} />
                <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>
                  Video is being processed. Check back shortly.
                </Typography>
              </Box>
            ) : (
              <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.9rem' }}>
                No video attached
              </Typography>
            )}

            <IconButton
              onClick={onClose}
              size="small"
              sx={{
                position: 'absolute',
                top: 10,
                right: 10,
                background: 'rgba(0,0,0,0.55)',
                color: '#fff',
                '&:hover': { background: 'rgba(0,0,0,0.75)' },
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        )}

        {/* ── Text / Audio / PDF: emoji thumbnail header ── */}
        {!isVideo && (
          <Box
            sx={{
              height: 140,
              background: content ? (THUMB_GRADIENTS[content.type] ?? '#F8FAFC') : '#F8FAFC',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {isLoading ? (
              <CircularProgress />
            ) : (
              <Typography sx={{ fontSize: '3.5rem' }}>{content?.emoji}</Typography>
            )}

            {content && (
              <>
                <Chip
                  label={content.type}
                  size="small"
                  sx={{
                    position: 'absolute',
                    top: 12,
                    left: 12,
                    background: typeColor.bg,
                    color: typeColor.color,
                    fontWeight: 800,
                    fontSize: '0.68rem',
                    textTransform: 'uppercase',
                  }}
                />
                <Chip
                  label={content.scope === 'global' ? '🌍 Global' : '🏫 Org'}
                  size="small"
                  sx={{
                    position: 'absolute',
                    top: 12,
                    right: 48,
                    background: content.scope === 'global' ? '#FEF3C7' : '#EDE9FE',
                    color: content.scope === 'global' ? '#92400E' : '#5B21B6',
                    fontWeight: 800,
                    fontSize: '0.68rem',
                  }}
                />
              </>
            )}

            <IconButton
              onClick={onClose}
              size="small"
              sx={{ position: 'absolute', top: 8, right: 8, background: 'rgba(255,255,255,0.8)' }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        )}

        {/* ── Body ── */}
        <Box sx={{ p: 3 }}>
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : content ? (
            <>
              {/* For video: type + scope chips inline since no thumbnail header */}
              {isVideo && (
                <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
                  <Chip
                    label={content.type}
                    size="small"
                    sx={{
                      background: typeColor.bg,
                      color: typeColor.color,
                      fontWeight: 800,
                      fontSize: '0.68rem',
                      textTransform: 'uppercase',
                    }}
                  />
                  <Chip
                    label={content.scope === 'global' ? '🌍 Global' : '🏫 Org'}
                    size="small"
                    sx={{
                      background: content.scope === 'global' ? '#FEF3C7' : '#EDE9FE',
                      color: content.scope === 'global' ? '#92400E' : '#5B21B6',
                      fontWeight: 800,
                      fontSize: '0.68rem',
                    }}
                  />
                </Box>
              )}

              <Typography variant="h5" sx={{ mb: 0.5, lineHeight: 1.3 }}>
                {content.title}
              </Typography>

              <Box
                sx={{
                  display: 'flex',
                  gap: 1.5,
                  flexWrap: 'wrap',
                  mb: 2,
                  color: 'text.secondary',
                  fontSize: '0.82rem',
                }}
              >
                {content.subject && <span>📖 {content.subject}</span>}
                <span>👁 {content.views} views</span>
                {content.author_name && <span>✍️ {content.author_name}</span>}
                {content.org_name && <span>🏫 {content.org_name}</span>}
              </Box>

              <Divider sx={{ mb: 2 }} />

              {/* ── PDF viewer ── */}
              {isPdf && (
                <Box sx={{ mb: 2 }}>
                  {isTokenLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                      <CircularProgress size={28} />
                    </Box>
                  ) : streamUrl ? (
                    <PdfViewer url={streamUrl} />
                  ) : (
                    <Typography color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      No PDF attached.
                    </Typography>
                  )}
                </Box>
              )}

              {/* ── Audio player ── */}
              {isAudio && (
                <Box sx={{ mb: content.body ? 2.5 : 0 }}>
                  {content.hls_ready && Hls.isSupported() ? (
                    <HlsAudioPlayer contentId={content.id} />
                  ) : content.file_id && !content.hls_ready ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1 }}>
                      <CircularProgress size={20} />
                      <Typography color="text.secondary" sx={{ fontSize: '0.9rem' }}>
                        Audio is being processed. Check back shortly.
                      </Typography>
                    </Box>
                  ) : (
                    <Typography color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      No audio attached.
                    </Typography>
                  )}
                </Box>
              )}

              {/* ── Text body ── */}
              {content.body && (
                <Box
                  sx={{
                    maxHeight: 400,
                    overflowY: 'auto',
                    pr: 0.5,
                    '&::-webkit-scrollbar': { width: 6 },
                    '&::-webkit-scrollbar-track': { background: 'transparent' },
                    '&::-webkit-scrollbar-thumb': {
                      background: 'rgba(0,0,0,0.15)',
                      borderRadius: 3,
                    },
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: '0.95rem',
                      lineHeight: 1.8,
                      whiteSpace: 'pre-wrap',
                      color: 'text.primary',
                    }}
                  >
                    {content.body}
                  </Typography>
                </Box>
              )}

              {/* Empty state */}
              {!content.body && !content.file_id && (
                <Typography color="text.secondary" sx={{ fontStyle: 'italic' }}>
                  No content body attached.
                </Typography>
              )}
            </>
          ) : null}
        </Box>
      </DialogContent>
    </Dialog>
  );
}
