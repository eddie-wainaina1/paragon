import { useState } from 'react';
import { Box, Typography, Grid, Card, CardActionArea, CardContent, Button, Chip, Skeleton } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import LockOpenOutlinedIcon from '@mui/icons-material/LockOpenOutlined';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import { useAuthStore } from '@/store/authStore';
import { contentApi } from '@/api/content';
import { usersApi } from '@/api/users';
import { orgsApi } from '@/api/organizations';
import { classesApi } from '@/api/classes';
import ContentCard from '@/components/Content/ContentCard';
import ContentViewDialog from '@/components/Content/ContentViewDialog';
import { Role } from '@/constants';

interface StatCardProps {
  icon: React.ReactNode;
  value: number | string;
  label: string;
  color?: string;
}

function StatCard({ icon, value, label, color }: StatCardProps) {
  return (
    <Card>
      <CardContent sx={{ pb: '16px !important' }}>
        <Box sx={{ color: color ?? 'primary.main', mb: 0.5, display: 'flex', alignItems: 'center' }}>
          {icon}
        </Box>
        <Typography
          sx={{
            fontSize: '2rem',
            fontWeight: 700,
            color: color ?? 'primary.main',
            lineHeight: 1.2,
          }}
        >
          {value}
        </Typography>
        <Typography
          sx={{
            fontSize: '0.78rem',
            fontWeight: 700,
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

function ClassCard({ cls, action, onClick }: { cls: import('@/types').Class; action?: React.ReactNode; onClick?: () => void }) {
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardActionArea onClick={onClick} sx={{ flex: 1, alignItems: 'flex-start' }}>
        <CardContent sx={{ pb: '12px !important' }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
            <Typography fontWeight={700} fontSize="0.95rem" lineHeight={1.3}>
              {cls.name}
            </Typography>
            {cls.grade && (
              <Chip label={cls.grade} size="small" sx={{ fontSize: '0.72rem', fontWeight: 700, ml: 1, flexShrink: 0 }} />
            )}
          </Box>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
            {cls.teacher_name ?? 'Unknown teacher'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {cls.content_count} lesson{cls.content_count !== 1 ? 's' : ''} · {cls.student_count} student{cls.student_count !== 1 ? 's' : ''}
          </Typography>
          {action && <Box sx={{ mt: 1.5 }} onClick={(e) => e.stopPropagation()}>{action}</Box>}
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

export default function Dashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const isStudent = user?.role === Role.student;
  const isSuperAdmin = user?.role === Role.super_admin;

  const { data: contentList = [], isLoading: contentLoading } = useQuery({
    queryKey: ['content'],
    queryFn: () => contentApi.list(),
    enabled: !isStudent,
  });

  const { data: usersList = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(),
    enabled: !isStudent,
  });

  const { data: orgsList = [] } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => orgsApi.list(),
    enabled: isSuperAdmin,
  });

  const { data: enrolledClasses = [], isLoading: enrolledLoading } = useQuery({
    queryKey: ['classes'],
    queryFn: () => classesApi.list(),
  });

  const { data: availableClasses = [], isLoading: availableLoading } = useQuery({
    queryKey: ['classes', 'available'],
    queryFn: () => classesApi.listAvailable(),
    enabled: isStudent,
  });

  const [viewingId, setViewingId] = useState<string | null>(null);

  if (!user) return null;

  const recentContent = contentList.slice(0, 4);

  const WelcomeBanner = (
    <Box
      sx={{
        background: 'linear-gradient(135deg,#F97316 0%,#EA580C 60%,#92400E 100%)',
        borderRadius: 2,
        p: { xs: '20px 20px', md: '28px 32px' },
        color: '#fff',
        mb: 3.5,
      }}
    >
      <Typography variant="h4" sx={{ color: '#fff', mb: 0.5 }}>
        Welcome back, {user.name.split(' ')[0]}
      </Typography>
      <Typography sx={{ opacity: 0.9, fontSize: '0.95rem' }}>
        Nifty by Paragon — {user.org_name} · {Role.to_dict()[user.role]}
      </Typography>
    </Box>
  );

  // ── Student view ────────────────────────────────────────────────────────────
  if (isStudent) {
    return (
      <Box>
        {WelcomeBanner}

        {/* Stats */}
        <Grid container spacing={2} sx={{ mb: 3.5 }}>
          <Grid size={{ xs: 6, sm: 4 }}>
            <StatCard icon={<LockOpenOutlinedIcon />} value={availableLoading ? '…' : availableClasses.length} label="Available Classes" color="#22C55E" />
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <StatCard icon={<SchoolOutlinedIcon />} value={enrolledLoading ? '…' : enrolledClasses.length} label="My Classes" color="#F97316" />
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <StatCard icon={<CheckCircleOutlinedIcon />} value={0} label="Completed" color="#FACC15" />
          </Grid>
        </Grid>

        {/* Enrolled classes */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography sx={{ fontSize: '1.1rem', fontWeight: 700 }}>
            My Classes
          </Typography>
          <Button
            size="small"
            variant="contained"
            onClick={() => navigate('/app/classes')}
            sx={{ fontSize: '0.82rem', px: 2, py: 0.75 }}
          >
            View All
          </Button>
        </Box>
        <Grid container spacing={2.5} sx={{ mb: 4 }}>
          {enrolledLoading
            ? Array.from({ length: 3 }).map((_, i) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={i}>
                <Skeleton variant="rounded" height={120} sx={{ borderRadius: 2 }} />
              </Grid>
            ))
            : enrolledClasses.length === 0
              ? (
                <Grid size={{ xs: 12 }}>
                  <Box sx={{ textAlign: 'center', py: 5, color: 'text.secondary' }}>
                    <InboxOutlinedIcon sx={{ fontSize: '3rem', mb: 1, opacity: 0.4 }} />
                    <Typography>You haven't joined any classes yet.</Typography>
                  </Box>
                </Grid>
              )
              : enrolledClasses.slice(0, 3).map((c) => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={c.id}>
                  <ClassCard cls={c} onClick={() => navigate(`/app/classes/${c.id}`)} />
                </Grid>
              ))}
        </Grid>

        {/* Available classes */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography sx={{ fontSize: '1.1rem', fontWeight: 700 }}>
            Available Classes
          </Typography>
        </Box>
        <Grid container spacing={2.5}>
          {availableLoading
            ? Array.from({ length: 3 }).map((_, i) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={i}>
                <Skeleton variant="rounded" height={120} sx={{ borderRadius: 2 }} />
              </Grid>
            ))
            : availableClasses.length === 0
              ? (
                <Grid size={{ xs: 12 }}>
                  <Box sx={{ textAlign: 'center', py: 5, color: 'text.secondary' }}>
                    <CheckCircleOutlinedIcon sx={{ fontSize: '3rem', mb: 1, opacity: 0.4 }} />
                    <Typography>You're enrolled in all available classes.</Typography>
                  </Box>
                </Grid>
              )
              : availableClasses.slice(0, 6).map((c) => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={c.id}>
                  <ClassCard
                    cls={c}
                    onClick={() => navigate(`/app/classes/${c.id}`)}
                    action={
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => navigate('/app/classes')}
                        sx={{ fontSize: '0.78rem' }}
                      >
                        Join Class
                      </Button>
                    }
                  />
                </Grid>
              ))}
        </Grid>
      </Box>
    );
  }

  // ── Admin / teacher / other view ────────────────────────────────────────────
  return (
    <Box>
      {WelcomeBanner}

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 3.5 }}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard icon={<ArticleOutlinedIcon />} value={contentList.length} label="Content Items" color="#F97316" />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard icon={<GroupOutlinedIcon />} value={usersList.length} label="Users" color="#EA580C" />
        </Grid>
        {isSuperAdmin && (
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatCard icon={<BusinessOutlinedIcon />} value={orgsList.length} label="Organizations" color="#22C55E" />
          </Grid>
        )}
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard icon={<SchoolOutlinedIcon />} value={enrolledClasses.length} label="Classes" color="#FACC15" />
        </Grid>
      </Grid>

      {/* Recent content */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: 'text.primary' }}>
          Recent Content
        </Typography>
        <Button
          size="small"
          variant="contained"
          onClick={() => navigate('/app/content')}
          sx={{ fontSize: '0.82rem', px: 2, py: 0.75 }}
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
              <InboxOutlinedIcon sx={{ fontSize: '3rem', mb: 1, opacity: 0.4 }} />
              <Typography>No content yet. Create your first lesson.</Typography>
            </Box>
          </Grid>
        )}
      </Grid>

      <ContentViewDialog contentId={viewingId} onClose={() => setViewingId(null)} />
    </Box>
  );
}
