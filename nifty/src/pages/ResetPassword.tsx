import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Box, Typography, TextField, Button, Alert, CircularProgress, Paper } from '@mui/material';
import { authApi } from '@/api/auth';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await authApi.resetPassword({ token, new_password: password });
      setSuccess(true);
      setTimeout(() => navigate('/'), 2500);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Reset failed — the link may have expired';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Alert severity="error">Invalid reset link.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', bgcolor: '#FFF7ED' }}>
      <Paper
        elevation={0}
        sx={{ p: 4, maxWidth: 420, width: '100%', borderRadius: 4, border: '2px solid', borderColor: 'divider' }}
      >
        <Typography variant="h5" fontWeight={700} sx={{ mb: 0.5 }}>
          Set a new password
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Enter your new password below.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
            {error}
          </Alert>
        )}

        {success ? (
          <Alert severity="success" sx={{ borderRadius: 2 }}>
            Password updated! Redirecting to login…
          </Alert>
        ) : (
          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              label="New Password"
              type="password"
              fullWidth
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              slotProps={{ htmlInput: { minLength: 6 } }}
              sx={{ mb: 2 }}
              required
            />
            <TextField
              label="Confirm Password"
              type="password"
              fullWidth
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              sx={{ mb: 3 }}
              required
            />
            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={loading}
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
            >
              Reset Password →
            </Button>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
