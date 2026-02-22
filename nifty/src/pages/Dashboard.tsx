import { useState } from 'react';
import { Box, Typography, Grid, Card, CardContent, Button, Skeleton } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { contentApi } from '@/api/content';
import { usersApi } from '@/api/users';
import { orgsApi } from '@/api/organizations';
import { classesApi } from '@/api/classes';
import ContentCard from '@/components/Content/ContentCard';
import ContentViewDialog from '@/components/Content/ContentViewDialog';
import { ROLE_LABELS } from '@/types';

interface StatCardProps {
  icon: string;
  value: number | string;
  label: string;
  color?: string;
}

function StatCard({ icon, value, label, color }: StatCardProps) {
  return (
    <Card>
      <CardContent sx={{ pb: '16px !important' }}>
        <Typography sx={{ fontSize: '1.6rem', mb: 0.5 }}>{icon}</Typography>
        <Typography
          sx={{
            fontFamily: "'Fredoka One', cursive",
            fontSize: '2rem',
            color: color ?? 'primary.main',
            lineHeight: 1.2,
          }}
        >
          {value}
        </Typography>
        <Typography
          sx={{
            fontSize: '0.78rem',
            fontWeight: 800,
            color: 'text.secondary',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {label}
        </Typography>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const { data: contentList = [], isLoading: contentLoading } = useQuery({
    queryKey: ['content'],
    queryFn: () => contentApi.list(),
  });

  const { data: usersList = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(),
  });

  const { data: orgsList = [] } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => orgsApi.list(),
  });

  const { data: classesList = [] } = useQuery({
    queryKey: ['classes'],
    queryFn: () => classesApi.list(),
  });

  const [viewingId, setViewingId] = useState<string | null>(null);

  if (!user) return null;

  const recentContent = contentList.slice(0, 4);

  return (
    <Box>
      {/* Welcome banner */}
      <Box
        sx={{
          background: 'linear-gradient(135deg,#F97316 0%,#EA580C 60%,#92400E 100%)',
          borderRadius: 3,
          p: { xs: '20px 20px', md: '28px 32px' },
          color: '#fff',
          mb: 3.5,
          position: 'relative',
          overflow: 'hidden',
          '&::after': {
            content: '"🚀"',
            position: 'absolute',
            right: 28,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '4rem',
            opacity: 0.2,
          },
        }}
      >
        <Typography
          variant="h4"
          sx={{ color: '#fff', mb: 0.5, fontFamily: "'Fredoka One', cursive" }}
        >
          Hello, {user.name.split(' ')[0]}! 👋
        </Typography>
        <Typography sx={{ opacity: 0.9, fontSize: '0.95rem' }}>
          Welcome to Nifty by Paragon — {user.org_name} · {ROLE_LABELS[user.role]}
        </Typography>
      </Box>

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 3.5 }}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard icon="📚" value={contentList.length} label="Content Items" color="#F97316" />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard icon="👥" value={usersList.length} label="Users" color="#EA580C" />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard icon="🏫" value={orgsList.length} label="Organizations" color="#22C55E" />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard icon="🎓" value={classesList.length} label="Classes" color="#FACC15" />
        </Grid>
      </Grid>

      {/* Recent content */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography
          sx={{ fontFamily: "'Fredoka One', cursive", fontSize: '1.2rem', color: 'text.primary' }}
        >
          📌 Recent Content
        </Typography>
        <Button
          size="small"
          variant="contained"
          onClick={() => navigate('/app/content')}
          sx={{ borderRadius: 50, fontSize: '0.82rem', px: 2, py: 0.75 }}
        >
          View All
        </Button>
      </Box>

      <Grid container spacing={2.5}>
        {contentLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Grid size={{ xs: 12, sm: 6, md: 3 }} key={i}>
                <Skeleton variant="rounded" height={200} sx={{ borderRadius: 2 }} />
              </Grid>
            ))
          : recentContent.map((c) => (
              <Grid size={{ xs: 12, sm: 6, md: 3 }} key={c.id}>
                <ContentCard content={c} onClick={(c) => setViewingId(c.id)} />
              </Grid>
            ))}
        {!contentLoading && recentContent.length === 0 && (
          <Grid size={{ xs: 12 }}>
            <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
              <Typography sx={{ fontSize: '3.5rem', mb: 1 }}>📭</Typography>
              <Typography>No content yet. Create your first lesson!</Typography>
            </Box>
          </Grid>
        )}
      </Grid>

      <ContentViewDialog contentId={viewingId} onClose={() => setViewingId(null)} />
    </Box>
  );
}
