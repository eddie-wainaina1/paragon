import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  TextField,
  Button,
  Tab,
  Tabs,
  IconButton,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { authApi } from '@/api/auth';
import { useAuthStore } from '@/store/authStore';

type ModalView = 'login' | 'register' | 'forgot';

interface Props {
  open: boolean;
  initialTab?: 'login' | 'register';
  onClose: () => void;
}

export default function AuthModal({ open, initialTab = 'login', onClose }: Props) {
  const [tab, setTab] = useState<'login' | 'register'>(initialTab);
  const [view, setView] = useState<ModalView>(initialTab);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [registerSuccess, setRegisterSuccess] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);

  // Login form state
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState('');

  // Register form state
  const [orgName, setOrgName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');

  // Forgot password form state
  const [forgotEmail, setForgotEmail] = useState('');

  // Sync tab + reset form whenever the modal opens or initialTab changes
  useEffect(() => {
    if (open) {
      setTab(initialTab);
      setView(initialTab);
      setError('');
      setRegisterSuccess(false);
      setForgotSuccess(false);
      setEmail('');
      setPassword('');
      setOrgName('');
      setFirstName('');
      setLastName('');
      setRegEmail('');
      setRegPassword('');
      setForgotEmail('');
    }
  }, [open, initialTab]);

  const handleTabChange = (_: React.SyntheticEvent, v: 'login' | 'register') => {
    setTab(v);
    setView(v);
    setError('');
    setRegisterSuccess(false);
    setForgotSuccess(false);
  };

  const switchView = (v: ModalView) => {
    setView(v);
    if (v === 'login' || v === 'register') setTab(v);
    setError('');
    setForgotSuccess(false);
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.login({ email, password });
      setAuth(res.user, res.access_token);
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Login failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    if (!orgName || !firstName || !regEmail || !regPassword) {
      setError('Please fill all required fields');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.registerOrg({
        org_name: orgName,
        admin_first: firstName,
        admin_last: lastName,
        email: regEmail,
        password: regPassword,
      });
      if (res.user.verified === false) {
        setRegisterSuccess(true);
      } else {
        setAuth(res.user, res.access_token);
        onClose();
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Registration failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authApi.forgotPassword({ email: forgotEmail });
      setForgotSuccess(true);
    } catch {
      // Always show success to avoid user enumeration
      setForgotSuccess(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 4,
          p: 1,
          border: '2px solid',
          borderColor: 'divider',
        },
      }}
    >
      <DialogContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          {view !== 'forgot' ? (
            <Tabs value={tab} onChange={handleTabChange}>
              <Tab label="Sign In" value="login" sx={{ fontWeight: 700 }} />
              <Tab label="Register Organization" value="register" sx={{ fontWeight: 700 }} />
            </Tabs>
          ) : (
            <Typography fontWeight={700} fontSize="0.95rem" color="text.secondary" sx={{ pl: 1 }}>
              Forgot Password
            </Typography>
          )}
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
            {error}
          </Alert>
        )}

        {/* ── LOGIN ── */}
        {view === 'login' && (
          <Box component="form" onSubmit={handleLogin}>
            <Typography variant="h5" sx={{ mb: 0.5 }}>
              Welcome back! 👋
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Sign in to your Nifty by Paragon account
            </Typography>
            <TextField
              label="Email"
              type="email"
              fullWidth
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              sx={{ mb: 2 }}
              required
            />
            <TextField
              label="Password"
              type="password"
              fullWidth
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              sx={{ mb: 1 }}
              required
            />
            <Box sx={{ textAlign: 'right', mb: 2 }}>
              <Box
                component="span"
                sx={{ fontSize: '0.8rem', color: 'primary.main', fontWeight: 600, cursor: 'pointer' }}
                onClick={() => switchView('forgot')}
              >
                Forgot password?
              </Box>
            </Box>
            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={loading}
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
            >
              Sign In →
            </Button>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
              Don't have an account?{' '}
              <Box
                component="span"
                sx={{ color: 'primary.main', fontWeight: 700, cursor: 'pointer' }}
                onClick={() => switchView('register')}
              >
                Register Organization
              </Box>
            </Typography>
          </Box>
        )}

        {/* ── REGISTER ── */}
        {view === 'register' && (
          <Box component="form" onSubmit={handleRegister}>
            <Typography variant="h5" sx={{ mb: 0.5 }}>
              Register Organization 🏫
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Create your school's account on Nifty by Paragon
            </Typography>

            {registerSuccess && (
              <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>
                Account created — please check your email to verify your account before logging in.
              </Alert>
            )}

            <TextField
              label="Organization Name"
              fullWidth
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="e.g. Sunrise Academy"
              sx={{ mb: 2 }}
              required
            />
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
              <TextField
                label="Admin First Name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
              <TextField
                label="Admin Last Name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </Box>
            <TextField
              label="Admin Email"
              type="email"
              fullWidth
              value={regEmail}
              onChange={(e) => setRegEmail(e.target.value)}
              placeholder="admin@school.edu"
              sx={{ mb: 2 }}
              required
            />
            <TextField
              label="Password"
              type="password"
              fullWidth
              value={regPassword}
              onChange={(e) => setRegPassword(e.target.value)}
              sx={{ mb: 3 }}
              required
            />
            <Button
              type="submit"
              variant="contained"
              color="secondary"
              fullWidth
              size="large"
              disabled={loading}
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
            >
              Create Organization →
            </Button>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
              Already have an account?{' '}
              <Box
                component="span"
                sx={{ color: 'primary.main', fontWeight: 700, cursor: 'pointer' }}
                onClick={() => switchView('login')}
              >
                Sign In
              </Box>
            </Typography>
          </Box>
        )}

        {/* ── FORGOT PASSWORD ── */}
        {view === 'forgot' && (
          <Box component="form" onSubmit={handleForgotPassword}>
            <Typography variant="h5" sx={{ mb: 0.5 }}>
              Reset your password
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Enter your email and we'll send you a reset link.
            </Typography>

            {forgotSuccess ? (
              <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>
                If an account with that email exists, a reset link has been sent. Check your inbox.
              </Alert>
            ) : (
              <>
                <TextField
                  label="Email"
                  type="email"
                  fullWidth
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
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
                  Send Reset Link →
                </Button>
              </>
            )}

            <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
              <Box
                component="span"
                sx={{ color: 'primary.main', fontWeight: 700, cursor: 'pointer' }}
                onClick={() => switchView('login')}
              >
                Back to Sign In
              </Box>
            </Typography>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
