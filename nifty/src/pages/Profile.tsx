import { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  Avatar,
  Chip,
  Alert,
} from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { usersApi } from '@/api/users';
import { useAuthStore } from '@/store/authStore';
import { ROLE_LABELS } from '@/types';

const ROLE_AVATAR_BG: Record<string, string> = {
  super_admin: 'linear-gradient(135deg,#F97316,#EA580C)',
  tutor: 'linear-gradient(135deg,#F97316,#FACC15)',
  finance: 'linear-gradient(135deg,#FACC15,#F97316)',
  org_admin: 'linear-gradient(135deg,#EA580C,#C2410C)',
  teacher: 'linear-gradient(135deg,#22C55E,#F97316)',
  student: 'linear-gradient(135deg,#F97316,#FBBF24)',
};

export default function Profile() {
  const { user, setAuth, clearAuth } = useAuthStore();
  const [displayName, setDisplayName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!user) throw new Error('Not authenticated');
      const updates: Record<string, string> = {};
      if (displayName !== user.name) updates.name = displayName;
      if (email !== user.email) updates.email = email;
      if (newPassword) updates.password = newPassword;
      return usersApi.updateMe(updates);
    },
    onSuccess: (updated) => {
      // Update auth store with new user data (keep same token)
      // Zustand persist wraps state as { state: { user, token }, version: 0 }
      const raw = localStorage.getItem('nifty-auth');
      const token = raw
        ? ((JSON.parse(raw) as { state?: { token?: string } }).state?.token ?? '')
        : '';
      setAuth(updated, token);
      setSuccess('Profile updated successfully!');
      setNewPassword('');
      setError('');
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Update failed';
      setError(msg);
    },
  });

  const handleLogout = () => {
    clearAuth();
    window.location.href = '/';
  };

  if (!user) return null;

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 0.5 }}>
        ⚙️ Profile & Settings
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Manage your account
      </Typography>

      <Card sx={{ maxWidth: 600 }}>
        <CardContent sx={{ p: 3.5 }}>
          {/* User avatar block */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <Avatar
              sx={{
                width: 64,
                height: 64,
                fontSize: '1.4rem',
                fontWeight: 800,
                background: ROLE_AVATAR_BG[user.role] ?? ROLE_AVATAR_BG.student,
              }}
            >
              {user.avatar}
            </Avatar>
            <Box>
              <Typography
                sx={{
                  fontFamily: "'Fredoka One', cursive",
                  fontSize: '1.4rem',
                }}
              >
                {user.name}
              </Typography>
              <Typography color="text.secondary" fontSize="0.9rem">
                {user.email}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                <Chip
                  label={ROLE_LABELS[user.role]}
                  size="small"
                  sx={{ background: '#FFEDD5', color: '#C2410C', fontWeight: 700 }}
                />
                <Chip
                  label={user.org_name}
                  size="small"
                  variant="outlined"
                  sx={{ fontWeight: 700 }}
                />
              </Box>
            </Box>
          </Box>

          {success && (
            <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>
              {success}
            </Alert>
          )}
          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={(e) => { e.preventDefault(); updateMutation.mutate(); }}>
            <TextField
              label="Display Name"
              fullWidth
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              sx={{ mb: 2 }}
            />
            <TextField
              label="Email"
              type="email"
              fullWidth
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              sx={{ mb: 2 }}
            />
            <TextField
              label="New Password"
              type="password"
              fullWidth
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Leave blank to keep current"
              sx={{ mb: 3 }}
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                type="submit"
                variant="contained"
                disabled={updateMutation.isPending}
              >
                Save Changes
              </Button>
              <Button
                variant="contained"
                color="error"
                onClick={handleLogout}
              >
                Sign Out
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
