import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Avatar,
  IconButton,
  Tooltip,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuthStore } from '@/store/authStore';
import { ROLE_LABELS } from '@/types';

const ROLE_AVATAR_COLORS: Record<string, string> = {
  super_admin: 'linear-gradient(135deg,#F97316,#EA580C)',
  tutor: 'linear-gradient(135deg,#F97316,#FACC15)',
  finance: 'linear-gradient(135deg,#FACC15,#F97316)',
  org_admin: 'linear-gradient(135deg,#EA580C,#C2410C)',
  teacher: 'linear-gradient(135deg,#22C55E,#F97316)',
  student: 'linear-gradient(135deg,#F97316,#FBBF24)',
};

export default function Topbar() {
  const { user, clearAuth } = useAuthStore();

  if (!user) return null;

  const handleLogout = () => {
    clearAuth();
    window.location.href = '/';
  };

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        background: '#fff',
        borderBottom: '2px solid',
        borderColor: 'divider',
        color: 'text.primary',
        zIndex: 100,
      }}
    >
      <Toolbar sx={{ px: { xs: 2, sm: 3 }, gap: 2 }}>
        {/* Logo */}
        <Typography
          variant="h6"
          sx={{
            fontFamily: "'Fredoka One', cursive",
            color: 'primary.main',
            letterSpacing: '0.01em',
            flex: 1,
          }}
        >
          <Box component="span" sx={{ color: 'primary.dark' }}>
            Nifty
          </Box>{' '}
          by Paragon
        </Typography>

        {/* Notifications */}
        <Tooltip title="Notifications">
          <IconButton color="default">
            <NotificationsIcon />
          </IconButton>
        </Tooltip>

        {/* User info */}
        <Box sx={{ textAlign: 'right', display: { xs: 'none', sm: 'block' } }}>
          <Typography variant="body2" fontWeight={700} lineHeight={1.2}>
            {user.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {ROLE_LABELS[user.role]}
          </Typography>
        </Box>

        {/* Avatar */}
        <Avatar
          sx={{
            width: 38,
            height: 38,
            fontSize: '0.85rem',
            fontWeight: 800,
            background: ROLE_AVATAR_COLORS[user.role] ?? ROLE_AVATAR_COLORS.tutor,
            cursor: 'pointer',
          }}
        >
          {user.avatar}
        </Avatar>

        {/* Logout */}
        <Tooltip title="Sign out">
          <IconButton onClick={handleLogout} size="small" color="default">
            <LogoutIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Toolbar>
    </AppBar>
  );
}
