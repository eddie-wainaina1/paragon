import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Avatar,
  IconButton,
  Tooltip,
  Button,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import LogoutIcon from '@mui/icons-material/Logout';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { Role } from '@/constants';

const ROLE_AVATAR_COLORS: Record<string, string> = {
  super_admin: 'linear-gradient(135deg,#F97316,#EA580C)',
  tutor: 'linear-gradient(135deg,#F97316,#FACC15)',
  finance: 'linear-gradient(135deg,#FACC15,#F97316)',
  org_admin: 'linear-gradient(135deg,#EA580C,#C2410C)',
  teacher: 'linear-gradient(135deg,#22C55E,#F97316)',
  student: 'linear-gradient(135deg,#F97316,#FBBF24)',
};

export default function Topbar() {
  const { user, clearAuth, isImpersonating, stopImpersonating, originalUser } = useAuthStore();
  const { mode, toggleMode } = useThemeStore();
  const navigate = useNavigate();

  if (!user) return null;

  const handleLogout = () => {
    clearAuth();
    window.location.href = '/';
  };

  const handleStopImpersonating = () => {
    stopImpersonating();
    navigate('/app/users');
  };

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        bgcolor: 'background.paper',
        borderBottom: '2px solid',
        borderColor: 'divider',
        color: 'text.primary',
        zIndex: 100,
      }}
    >
      {isImpersonating() && (
        <Box
          sx={{
            background: 'linear-gradient(90deg,#F97316,#EA580C)',
            color: '#fff',
            px: 3,
            py: 0.75,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            fontSize: '0.85rem',
            fontWeight: 700,
          }}
        >
          <Typography fontSize="inherit" fontWeight="inherit">
            Viewing as <strong>{user.name}</strong> &middot; {Role.to_dict()[user.role]}
            {originalUser && (
              <Box component="span" sx={{ fontWeight: 400, ml: 1, opacity: 0.85 }}>
                (you are {originalUser.name})
              </Box>
            )}
          </Typography>
          <Button
            size="small"
            variant="outlined"
            onClick={handleStopImpersonating}
            sx={{
              color: '#fff',
              borderColor: 'rgba(255,255,255,0.6)',
              borderRadius: 50,
              fontSize: '0.78rem',
              fontWeight: 700,
              py: 0.25,
              '&:hover': { borderColor: '#fff', background: 'rgba(255,255,255,0.15)' },
            }}
          >
            Stop Impersonating
          </Button>
        </Box>
      )}
      <Toolbar sx={{ px: { xs: 2, sm: 3 }, gap: 2 }}>
        {/* Logo */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
          <Box component="img" src="/favicon.svg" alt="Nifty" sx={{ width: 28, height: 28 }} />
          <Typography
            variant="h6"
            sx={{
              fontFamily: "'Fredoka One', cursive",
              letterSpacing: '0.01em',
              color: 'text.primary',
              lineHeight: 1,
            }}
          >
            <Box component="span" sx={{ color: 'primary.main' }}>Nifty</Box>{' '}by Paragon
          </Typography>
        </Box>

        {/* Notifications */}
        <Tooltip title="Notifications">
          <IconButton color="default">
            <NotificationsIcon />
          </IconButton>
        </Tooltip>

        {/* Dark / light mode toggle */}
        <Tooltip title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
          <IconButton onClick={toggleMode} color="default" size="small">
            {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
          </IconButton>
        </Tooltip>

        {/* User info */}
        <Box sx={{ textAlign: 'right', display: { xs: 'none', sm: 'block' } }}>
          <Typography variant="body2" fontWeight={700} lineHeight={1.2}>
            {user.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {Role.to_dict()[user.role]}
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
