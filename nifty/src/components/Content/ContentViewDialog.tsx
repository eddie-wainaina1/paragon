import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  Chip,
  IconButton,
  Divider,
  Button,
  CircularProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import { useQuery } from '@tanstack/react-query';
import { contentApi } from '@/api/content';
import apiClient from '@/api/client';

const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  text: { bg: '#DBEAFE', color: '#1D4ED8' },
  video: { bg: '#FCE7F3', color: '#BE185D' },
  audio: { bg: '#D1FAE5', color: '#065F46' },
};

const THUMB_GRADIENTS: Record<string, string> = {
  text: 'linear-gradient(135deg,#DBEAFE,#EFF6FF)',
  video: 'linear-gradient(135deg,#FCE7F3,#FDF2F8)',
  audio: 'linear-gradient(135deg,#D1FAE5,#ECFDF5)',
};

interface Props {
  contentId: string | null;
  onClose: () => void;
}

export default function ContentViewDialog({ contentId, onClose }: Props) {
  const open = !!contentId;

  // Fetching via GET /content/{id} also increments views on the backend
  const { data: content, isLoading } = useQuery({
    queryKey: ['content', contentId],
    queryFn: () => contentApi.get(contentId!),
    enabled: open,
  });

  const handleDownload = async () => {
    if (!content?.file_id) return;
    try {
      const res = await apiClient.get(`/content/${content.id}/file`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = content.file_name ?? 'download';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  };

  const typeColor = content ? (TYPE_COLORS[content.type] ?? TYPE_COLORS.text) : TYPE_COLORS.text;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 4, border: '2px solid', borderColor: 'divider' } }}
    >
      <DialogContent sx={{ p: 0 }}>
        {/* Thumbnail header */}
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

        {/* Body */}
        <Box sx={{ p: 3 }}>
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : content ? (
            <>
              <Typography variant="h5" sx={{ mb: 0.5, lineHeight: 1.3 }}>
                {content.title}
              </Typography>

              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2, color: 'text.secondary', fontSize: '0.82rem' }}>
                {content.subject && <span>📖 {content.subject}</span>}
                <span>👁 {content.views} views</span>
                {content.author_name && <span>✍️ {content.author_name}</span>}
                {content.org_name && <span>🏫 {content.org_name}</span>}
              </Box>

              <Divider sx={{ mb: 2 }} />

              {/* Body text */}
              {content.body && (
                <Typography
                  sx={{
                    fontSize: '0.95rem',
                    lineHeight: 1.7,
                    whiteSpace: 'pre-wrap',
                    color: 'text.primary',
                    mb: content.file_id ? 2 : 0,
                  }}
                >
                  {content.body}
                </Typography>
              )}

              {/* File download */}
              {content.file_id && (
                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  onClick={handleDownload}
                  sx={{ borderRadius: 50, mt: content.body ? 0 : 0 }}
                >
                  {content.file_name ?? 'Download File'}
                </Button>
              )}

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
