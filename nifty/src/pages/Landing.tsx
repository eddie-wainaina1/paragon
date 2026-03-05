import { useState, useEffect } from 'react';
import axios from 'axios';
import { Box, Typography, Button, Chip, keyframes } from '@mui/material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AuthModal from '@/components/Auth/AuthModal';
import { useAuthStore } from '@/store/authStore';
import type { User } from '@/types';

const floatAnim = keyframes`
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50%       { transform: translateY(-16px) rotate(8deg); }
`;

const FLOATING_ICONS = ['💻', '🤖', '🔬', '🎮', '⚡', '🌐'];
const FLOATING_POSITIONS: Array<{ top?: string; bottom?: string; left?: string; right?: string }> = [
  { top: '8%', left: '6%' },
  { top: '15%', right: '8%' },
  { bottom: '20%', left: '10%' },
  { bottom: '10%', right: '12%' },
  { top: '50%', left: '3%' },
  { top: '40%', right: '4%' },
];
const ROLES = ['🏫 Organizations', '👩‍🏫 Teachers', '🎓 Students', '⭐ Tutors'];

export default function Landing() {
  const [modalOpen, setModalOpen] = useState(false);
  const [initialTab, setInitialTab] = useState<'login' | 'register' | 'individual'>('login');
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const verified = searchParams.get('verified');
    const token = searchParams.get('token');

    if (verified === 'true' && token) {
      const BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1';
      axios
        .get<User>(`${BASE_URL}/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((res) => {
          setAuth(res.data, token);
          navigate('/app/dashboard', { replace: true });
        })
        .catch(() => {
          // Token invalid/expired — fall back to sign-in modal
          setInitialTab('login');
          setModalOpen(true);
        });
    } else if (verified || searchParams.get('login')) {
      setInitialTab('login');
      setModalOpen(true);
    }
  }, []);

  const openLogin = () => {
    setInitialTab('login');
    setModalOpen(true);
  };

  const openRegister = () => {
    setInitialTab('register');
    setModalOpen(true);
  };

  const openIndividual = () => {
    setInitialTab('individual');
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    if (isAuthenticated) {
      navigate('/app/dashboard');
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(145deg, #F97316 0%, #EA580C 40%, #C2410C 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        px: 3,
        py: 5,
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          background: `
            radial-gradient(circle at 15% 25%, rgba(255,255,255,0.18) 0%, transparent 55%),
            radial-gradient(circle at 85% 75%, rgba(0,0,0,0.12) 0%, transparent 50%)
          `,
          pointerEvents: 'none',
        },
      }}
    >
      {/* Floating icons */}
      {FLOATING_ICONS.map((icon, i) => (
        <Box
          key={icon}
          sx={{
            position: 'absolute',
            fontSize: '2rem',
            opacity: 0.13,
            animation: `${floatAnim} 6s ease-in-out infinite`,
            animationDelay: `${i * 0.8}s`,
            top: FLOATING_POSITIONS[i].top,
            bottom: FLOATING_POSITIONS[i].bottom,
            left: FLOATING_POSITIONS[i].left,
            right: FLOATING_POSITIONS[i].right,
            pointerEvents: 'none',
          }}
        >
          {icon}
        </Box>
      ))}

      {/* Logo */}
      <Typography
        sx={{
          fontFamily: "'Fredoka One', cursive",
          fontSize: { xs: '2.4rem', md: '3rem' },
          color: '#fff',
          textAlign: 'center',
          lineHeight: 1.1,
          zIndex: 1,
          textShadow: '0 3px 12px rgba(0,0,0,0.25)',
          letterSpacing: '0.01em',
        }}
      >
        <Box component="span" sx={{ color: '#FDE68A' }}>
          Nifty
        </Box>{' '}
        by Paragon
      </Typography>

      {/* Tagline */}
      <Typography
        sx={{
          color: 'rgba(255,255,255,0.92)',
          fontSize: '1.1rem',
          textAlign: 'center',
          maxWidth: 420,
          zIndex: 1,
          fontWeight: 500,
        }}
      >
        The smart platform where schools, teachers, and students explore the world of technology
        together.
      </Typography>

      {/* Role chips */}
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'center', zIndex: 1 }}>
        {ROLES.map((r) => (
          <Chip
            key={r}
            label={r}
            sx={{
              background: 'rgba(255,255,255,0.22)',
              backdropFilter: 'blur(8px)',
              color: '#fff',
              fontWeight: 600,
              fontSize: '0.85rem',
              border: '1px solid rgba(255,255,255,0.4)',
              height: 32,
            }}
          />
        ))}
      </Box>

      {/* CTA Buttons */}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center', zIndex: 1 }}>
        <Button
          variant="contained"
          size="large"
          onClick={openLogin}
          sx={{
            background: '#fff',
            color: '#F97316',
            fontWeight: 700,
            px: 4,
            py: 1.4,
            fontSize: '1rem',
            boxShadow: '0 4px 20px rgba(0,0,0,0.20)',
            '&:hover': {
              background: '#fff',
              transform: 'translateY(-2px)',
              boxShadow: '0 8px 28px rgba(0,0,0,0.28)',
            },
          }}
        >
          Sign In
        </Button>
        <Button
          variant="outlined"
          size="large"
          onClick={openRegister}
          sx={{
            borderColor: 'rgba(255,255,255,0.75)',
            color: '#fff',
            fontWeight: 700,
            px: 4,
            py: 1.4,
            fontSize: '1rem',
            '&:hover': {
              background: 'rgba(255,255,255,0.18)',
              borderColor: '#fff',
            },
          }}
        >
          Register Organization
        </Button>
        <Button
          variant="outlined"
          size="large"
          onClick={openIndividual}
          sx={{
            borderColor: 'rgba(255,255,255,0.75)',
            color: '#fff',
            fontWeight: 700,
            px: 4,
            py: 1.4,
            fontSize: '1rem',
            '&:hover': {
              background: 'rgba(255,255,255,0.18)',
              borderColor: '#fff',
            },
          }}
        >
          Join as Individual
        </Button>
      </Box>

      <AuthModal
        open={modalOpen}
        initialTab={initialTab}
        onClose={handleModalClose}
      />
    </Box>
  );
}
