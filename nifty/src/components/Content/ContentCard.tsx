import { Card, CardActionArea, Box, Typography, Chip } from '@mui/material';
import type { Content } from '@/types';

const THUMB_GRADIENTS: Record<string, string> = {
  text: 'linear-gradient(135deg,#DBEAFE,#EFF6FF)',
  video: 'linear-gradient(135deg,#FCE7F3,#FDF2F8)',
  audio: 'linear-gradient(135deg,#D1FAE5,#ECFDF5)',
};

const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  text: { bg: '#DBEAFE', color: '#1D4ED8' },
  video: { bg: '#FCE7F3', color: '#BE185D' },
  audio: { bg: '#D1FAE5', color: '#065F46' },
};

interface Props {
  content: Content;
  onClick?: (content: Content) => void;
}

export default function ContentCard({ content, onClick }: Props) {
  const typeColor = TYPE_COLORS[content.type] ?? TYPE_COLORS.text;

  return (
    <Card
      sx={{
        cursor: 'pointer',
        transition: 'all .2s',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: '0 12px 32px rgba(249,115,22,0.18)',
        },
      }}
    >
      <CardActionArea onClick={() => onClick?.(content)}>
        {/* Thumbnail */}
        <Box
          sx={{
            height: 130,
            background: THUMB_GRADIENTS[content.type] ?? '#F8FAFC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          <Typography sx={{ fontSize: '2.8rem' }}>{content.emoji}</Typography>

          {/* Type badge — top left */}
          <Chip
            label={content.type}
            size="small"
            sx={{
              position: 'absolute',
              top: 10,
              left: 10,
              background: typeColor.bg,
              color: typeColor.color,
              fontWeight: 800,
              fontSize: '0.68rem',
              textTransform: 'uppercase',
              height: 22,
            }}
          />

          {/* Scope badge — top right */}
          <Chip
            label={content.scope === 'global' ? '🌍 Global' : '🏫 Org'}
            size="small"
            sx={{
              position: 'absolute',
              top: 10,
              right: 10,
              background: content.scope === 'global' ? '#FEF3C7' : '#EDE9FE',
              color: content.scope === 'global' ? '#92400E' : '#5B21B6',
              fontWeight: 800,
              fontSize: '0.68rem',
              height: 22,
            }}
          />
        </Box>

        {/* Body */}
        <Box sx={{ p: '14px 16px' }}>
          <Typography
            fontWeight={800}
            fontSize="0.95rem"
            color="text.primary"
            sx={{ mb: 0.5, lineHeight: 1.3 }}
          >
            {content.title}
          </Typography>
          <Box
            sx={{
              display: 'flex',
              gap: 1,
              flexWrap: 'wrap',
              fontSize: '0.78rem',
              color: 'text.secondary',
            }}
          >
            {content.subject && <span>📖 {content.subject}</span>}
            <span>👁 {content.views} views</span>
            {content.author_name && <span>✍️ {content.author_name}</span>}
          </Box>
        </Box>
      </CardActionArea>
    </Card>
  );
}
