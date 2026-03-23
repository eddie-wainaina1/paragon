import { Box, Alert, Typography, Button } from '@mui/material';
import { Outlet, Navigate, useLocation, Link as RouterLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Topbar from './Topbar';
import Sidebar from './Sidebar';
import { useAuthStore } from '@/store/authStore';
import TermsModal from '@/components/Terms/TermsModal';
import { subscriptionsApi } from '@/api/subscriptions';

export default function AppLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  const isStudent = user?.role === 'student';

  const { data: sub, isLoading: subLoading } = useQuery({
    queryKey: ['subscriptions', 'students', 'me'],
    queryFn: subscriptionsApi.getMySubscription,
    enabled: isStudent,
    retry: false,
  });

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // Gate: students must have a subscription before accessing the app.
  // Allow the /app/my-subscription route through so they can subscribe.
  if (isStudent && !subLoading && !sub && location.pathname !== '/app/my-subscription') {
    if (user?.tutor_application_pending) {
      return (
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            p: 4,
            textAlign: 'center',
            gap: 2,
          }}
        >
          <Typography variant="h5" fontWeight={700}>
            Your tutor application is in review
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 420 }}>
            We'll reach out to you soon to follow up. In the meantime, you can access the platform
            as a student.
          </Typography>
          <Button
            component={RouterLink}
            to="/app/my-subscription"
            variant="contained"
            sx={{ borderRadius: 50, mt: 1 }}
          >
            Subscribe as a student
          </Button>
        </Box>
      );
    }
    return <Navigate to="/app/my-subscription" replace />;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {user?.tutor_application_pending && (
        <Alert
          severity="info"
          sx={{
            borderRadius: 0,
            borderBottom: '1px solid',
            borderColor: 'info.light',
            '& .MuiAlert-message': { width: '100%', textAlign: 'center' },
          }}
        >
          Your tutor account application is currently under review. We'll reach out to you soon to follow up.
        </Alert>
      )}
      <Topbar />
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar />
        <Box
          component="main"
          sx={{
            flex: 1,
            overflowY: 'auto',
            p: { xs: 2, md: 3.5 },
            background: 'background.default',
          }}
        >
          <Outlet />
        </Box>
      </Box>
      <TermsModal open={!!user && !user.terms_accepted_at} />
    </Box>
  );
}
