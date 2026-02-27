import { Box } from '@mui/material';
import { Outlet, Navigate } from 'react-router-dom';
import Topbar from './Topbar';
import Sidebar from './Sidebar';
import { useAuthStore } from '@/store/authStore';
import TermsModal from '@/components/Terms/TermsModal';

export default function AppLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  const user = useAuthStore((s) => s.user);

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
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
