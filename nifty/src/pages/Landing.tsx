import { useState, useEffect } from 'react';
import axios from 'axios';
import { Box, Typography, Button, Chip, Grid, Paper, keyframes } from '@mui/material';
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

const FEATURES = [
  {
    icon: '📚',
    title: 'Rich Content Library',
    description:
      'Upload and deliver videos, PDFs, audio, and text materials — all in one organised, searchable library your school can access anytime.',
  },
  {
    icon: '🏫',
    title: 'Class Management',
    description:
      'Create classes, enrol students, and assign curated content. Keep your curriculum structured and your learners on track.',
  },
  {
    icon: '👥',
    title: 'Role-Based Access',
    description:
      'Every user sees exactly what they need. Admins manage the school, teachers run classes, and students focus on learning.',
  },
  {
    icon: '🔒',
    title: 'Secure & Scalable',
    description:
      'Organisation-level isolation, JWT authentication, and fine-grained permissions keep your data safe as you grow.',
  },
];

const HOW_IT_WORKS = [
  {
    step: '01',
    icon: '🏫',
    title: 'Register your school',
    description:
      'Sign up your institution in minutes. Add your admin account and invite teachers and students — no technical setup required.',
  },
  {
    step: '02',
    icon: '📖',
    title: 'Build your curriculum',
    description:
      'Upload lesson videos, PDFs, and reading materials. Organise content into classes and assign it to the right learners.',
  },
  {
    step: '03',
    icon: '🚀',
    title: 'Teach and learn',
    description:
      'Students access their class content on any device. Teachers track engagement. Admins keep everything running smoothly.',
  },
];

const TOPICS = [
  { icon: '💻', label: 'Programming & Coding' },
  { icon: '🤖', label: 'Artificial Intelligence' },
  { icon: '🔬', label: 'Robotics & Electronics' },
  { icon: '🎮', label: 'Game Development' },
  { icon: '🌐', label: 'Web & App Development' },
  { icon: '🔒', label: 'Cybersecurity' },
  { icon: '📊', label: 'Data & Analytics' },
  { icon: '⚡', label: 'Digital Innovation' },
];

const WHO_ITS_FOR = [
  {
    emoji: '🏫',
    role: 'Schools & Organisations',
    description:
      'Onboard your institution in minutes. Manage teachers, students, and content from a single admin dashboard.',
    action: 'Register your school',
    tab: 'register' as const,
  },
  {
    emoji: '👩‍🏫',
    role: 'Teachers',
    description:
      'Build classes, hand-pick learning materials, and watch your students engage with the content you assign.',
    action: 'Get started',
    tab: 'login' as const,
  },
  {
    emoji: '🎓',
    role: 'Students',
    description:
      'Access your class materials whenever you need them — videos, readings, and more — all in one place.',
    action: 'Join your class',
    tab: 'login' as const,
  },
  {
    emoji: '⭐',
    role: 'Tutors',
    description:
      'Create and share high-quality content beyond the classroom. Apply to join as an individual tutor and reach learners across multiple organisations.',
    action: 'Apply as a tutor',
    tab: 'individual' as const,
  },
];

const FAQS = [
  {
    q: 'How do I get my school on Nifty?',
    a: 'Click "Register Organisation" and create your admin account. You can then invite teachers and students, and start building classes straight away — no installation needed.',
  },
  {
    q: 'Can students access content on their phones?',
    a: 'Yes. Nifty is fully responsive and works in any modern browser on desktop, tablet, or mobile.',
  },
  {
    q: 'How does the tutor application work?',
    a: 'Select "Apply for a tutor account" when joining as an individual. Your account starts as a student while our team reviews your application, and we\'ll contact you via the phone number you provide.',
  },
  {
    q: 'Is my school\'s data kept private?',
    a: 'Absolutely. Each organisation has its own isolated data space. Users can only see content and classmates within their own institution.',
  },
];

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

  const openModal = (tab: 'login' | 'register' | 'individual') => {
    setInitialTab(tab);
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    if (isAuthenticated) {
      navigate('/app/dashboard');
    }
  };

  return (
    <Box component="main" sx={{ minHeight: '100vh', fontFamily: "'Nunito', sans-serif" }}>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <Box
        component="section"
        aria-label="Hero"
        sx={{
          minHeight: '100vh',
          background: 'linear-gradient(145deg, #F97316 0%, #EA580C 40%, #C2410C 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          px: 3,
          py: 8,
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
        {FLOATING_ICONS.map((icon, i) => (
          <Box
            key={icon}
            aria-hidden="true"
            sx={{
              position: 'absolute',
              fontSize: '2rem',
              opacity: 0.13,
              animation: `${floatAnim} 6s ease-in-out infinite`,
              animationDelay: `${i * 0.8}s`,
              ...FLOATING_POSITIONS[i],
              pointerEvents: 'none',
            }}
          >
            {icon}
          </Box>
        ))}

        <Typography
          component="h1"
          sx={{
            fontFamily: "'Fredoka One', cursive",
            fontSize: { xs: '2.6rem', md: '3.4rem' },
            color: '#fff',
            textAlign: 'center',
            lineHeight: 1.1,
            zIndex: 1,
            textShadow: '0 3px 12px rgba(0,0,0,0.25)',
            letterSpacing: '0.02em',
          }}
        >
          <Box component="span" sx={{ color: '#FDE68A' }}>
            Nifty
          </Box>{' '}
          by Paragon
        </Typography>

        <Typography
          component="p"
          sx={{
            color: 'rgba(255,255,255,0.95)',
            fontSize: { xs: '1.1rem', md: '1.25rem' },
            textAlign: 'center',
            maxWidth: 560,
            zIndex: 1,
            fontWeight: 500,
            lineHeight: 1.6,
          }}
        >
          The all-in-one platform for schools to deliver technology education — from coding and AI
          to robotics and cybersecurity.
        </Typography>

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

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center', zIndex: 1 }}>
          <Button
            variant="contained"
            size="large"
            onClick={() => openModal('login')}
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
            onClick={() => openModal('register')}
            sx={{
              borderColor: 'rgba(255,255,255,0.75)',
              color: '#fff',
              fontWeight: 700,
              px: 4,
              py: 1.4,
              fontSize: '1rem',
              '&:hover': { background: 'rgba(255,255,255,0.18)', borderColor: '#fff' },
            }}
          >
            Register Organisation
          </Button>
          <Button
            variant="outlined"
            size="large"
            onClick={() => openModal('individual')}
            sx={{
              borderColor: 'rgba(255,255,255,0.75)',
              color: '#fff',
              fontWeight: 700,
              px: 4,
              py: 1.4,
              fontSize: '1rem',
              '&:hover': { background: 'rgba(255,255,255,0.18)', borderColor: '#fff' },
            }}
          >
            Join as Individual
          </Button>
        </Box>

        {/* Scroll hint */}
        <Box
          aria-hidden="true"
          sx={{
            position: 'absolute',
            bottom: 32,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 0.5,
            opacity: 0.6,
            zIndex: 1,
          }}
        >
          <Typography sx={{ color: '#fff', fontSize: '0.7rem', fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase' }}>
            Learn more
          </Typography>
          <Box sx={{ width: 2, height: 24, background: 'rgba(255,255,255,0.6)', borderRadius: 1 }} />
        </Box>
      </Box>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <Box
        component="section"
        aria-label="Features"
        sx={{ py: { xs: 8, md: 12 }, px: 3, background: '#fff' }}
      >
        <Box sx={{ maxWidth: 900, mx: 'auto' }}>
          <Typography
            component="h2"
            sx={{
              fontFamily: "'Fredoka One', cursive",
              fontSize: { xs: '1.8rem', md: '2.4rem' },
              color: '#1a1a1a',
              textAlign: 'center',
              mb: 1.5,
            }}
          >
            Everything your school needs
          </Typography>
          <Typography
            sx={{
              color: '#666',
              textAlign: 'center',
              fontSize: '1.05rem',
              mb: 7,
              maxWidth: 560,
              mx: 'auto',
              lineHeight: 1.7,
            }}
          >
            One platform to manage your institution, deliver engaging content, and connect every
            member of your learning community.
          </Typography>

          <Grid container spacing={3}>
            {FEATURES.map((f) => (
              <Grid key={f.title} size={{ xs: 12, sm: 6 }}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 4,
                    height: '100%',
                    border: '1.5px solid #f0f0f0',
                    borderRadius: 3,
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      borderColor: '#F97316',
                      boxShadow: '0 4px 24px rgba(249,115,22,0.12)',
                    },
                  }}
                >
                  <Typography sx={{ fontSize: '2.2rem', mb: 2, lineHeight: 1 }}>{f.icon}</Typography>
                  <Typography
                    component="h3"
                    sx={{ fontWeight: 700, fontSize: '1.1rem', mb: 1, color: '#1a1a1a' }}
                  >
                    {f.title}
                  </Typography>
                  <Typography sx={{ color: '#555', lineHeight: 1.7, fontSize: '0.95rem' }}>
                    {f.description}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Box>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <Box
        component="section"
        aria-label="How Nifty works"
        sx={{ py: { xs: 8, md: 12 }, px: 3, background: '#FFF7ED' }}
      >
        <Box sx={{ maxWidth: 900, mx: 'auto' }}>
          <Typography
            component="h2"
            sx={{
              fontFamily: "'Fredoka One', cursive",
              fontSize: { xs: '1.8rem', md: '2.4rem' },
              color: '#1a1a1a',
              textAlign: 'center',
              mb: 1.5,
            }}
          >
            Up and running in three steps
          </Typography>
          <Typography
            sx={{
              color: '#666',
              textAlign: 'center',
              fontSize: '1.05rem',
              mb: 7,
              maxWidth: 500,
              mx: 'auto',
              lineHeight: 1.7,
            }}
          >
            No lengthy onboarding. No IT department required. Your school can be live and learning
            the same day.
          </Typography>

          <Grid container spacing={4}>
            {HOW_IT_WORKS.map((s) => (
              <Grid key={s.step} size={{ xs: 12, md: 4 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', height: '100%' }}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #F97316, #EA580C)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mb: 2,
                      flexShrink: 0,
                    }}
                  >
                    <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '0.9rem', fontFamily: "'Fredoka One', cursive" }}>
                      {s.step}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: '2rem', mb: 1.5, lineHeight: 1 }}>{s.icon}</Typography>
                  <Typography
                    component="h3"
                    sx={{ fontWeight: 700, fontSize: '1.05rem', mb: 1, color: '#1a1a1a' }}
                  >
                    {s.title}
                  </Typography>
                  <Typography sx={{ color: '#555', lineHeight: 1.7, fontSize: '0.95rem' }}>
                    {s.description}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>

          <Box sx={{ textAlign: 'center', mt: 6 }}>
            <Button
              variant="contained"
              size="large"
              onClick={() => openModal('register')}
              sx={{
                background: 'linear-gradient(135deg, #F97316, #EA580C)',
                color: '#fff',
                fontWeight: 700,
                px: 5,
                py: 1.5,
                fontSize: '1rem',
                boxShadow: '0 4px 20px rgba(249,115,22,0.35)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #EA580C, #C2410C)',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 8px 28px rgba(249,115,22,0.45)',
                },
              }}
            >
              Register your school for free →
            </Button>
          </Box>
        </Box>
      </Box>

      {/* ── Technology topics ─────────────────────────────────────────────── */}
      <Box
        component="section"
        aria-label="Technology topics"
        sx={{ py: { xs: 8, md: 12 }, px: 3, background: '#fff' }}
      >
        <Box sx={{ maxWidth: 860, mx: 'auto' }}>
          <Typography
            component="h2"
            sx={{
              fontFamily: "'Fredoka One', cursive",
              fontSize: { xs: '1.8rem', md: '2.4rem' },
              color: '#1a1a1a',
              textAlign: 'center',
              mb: 1.5,
            }}
          >
            Explore the world of technology
          </Typography>
          <Typography
            sx={{
              color: '#666',
              textAlign: 'center',
              fontSize: '1.05rem',
              mb: 6,
              maxWidth: 520,
              mx: 'auto',
              lineHeight: 1.7,
            }}
          >
            Nifty is purpose-built for tech education. Schools can deliver rich content across a
            wide range of digital and STEM disciplines.
          </Typography>

          <Grid container spacing={2} justifyContent="center">
            {TOPICS.map((t) => (
              <Grid key={t.label} size={{ xs: 6, sm: 4, md: 3 }}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2.5,
                    textAlign: 'center',
                    border: '1.5px solid #f0f0f0',
                    borderRadius: 3,
                    transition: 'border-color 0.2s, box-shadow 0.2s, transform 0.2s',
                    '&:hover': {
                      borderColor: '#F97316',
                      boxShadow: '0 4px 20px rgba(249,115,22,0.12)',
                      transform: 'translateY(-3px)',
                    },
                  }}
                >
                  <Typography sx={{ fontSize: '2rem', mb: 1, lineHeight: 1 }}>{t.icon}</Typography>
                  <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', color: '#1a1a1a', lineHeight: 1.4 }}>
                    {t.label}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Box>

      {/* ── Who it's for ─────────────────────────────────────────────────── */}
      <Box
        component="section"
        aria-label="Who Nifty is for"
        sx={{ py: { xs: 8, md: 12 }, px: 3, background: '#FFF7ED' }}
      >
        <Box sx={{ maxWidth: 960, mx: 'auto' }}>
          <Typography
            component="h2"
            sx={{
              fontFamily: "'Fredoka One', cursive",
              fontSize: { xs: '1.8rem', md: '2.4rem' },
              color: '#1a1a1a',
              textAlign: 'center',
              mb: 1.5,
            }}
          >
            Built for every role in education
          </Typography>
          <Typography
            sx={{
              color: '#666',
              textAlign: 'center',
              fontSize: '1.05rem',
              mb: 7,
              maxWidth: 540,
              mx: 'auto',
              lineHeight: 1.7,
            }}
          >
            Whether you run a school, teach a class, or learn at your own pace — Nifty has a
            tailored experience for you.
          </Typography>

          <Grid container spacing={3}>
            {WHO_ITS_FOR.map((w) => (
              <Grid key={w.role} size={{ xs: 12, sm: 6, md: 3 }}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 3.5,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    border: '1.5px solid #FDDCB0',
                    borderRadius: 3,
                    background: '#fff',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 8px 32px rgba(249,115,22,0.15)',
                    },
                  }}
                >
                  <Typography sx={{ fontSize: '2.4rem', mb: 1.5, lineHeight: 1 }}>
                    {w.emoji}
                  </Typography>
                  <Typography
                    component="h3"
                    sx={{ fontWeight: 700, fontSize: '1rem', mb: 1, color: '#1a1a1a' }}
                  >
                    {w.role}
                  </Typography>
                  <Typography
                    sx={{ color: '#555', lineHeight: 1.7, fontSize: '0.9rem', flexGrow: 1, mb: 2.5 }}
                  >
                    {w.description}
                  </Typography>
                  <Button
                    variant="text"
                    size="small"
                    onClick={() => openModal(w.tab)}
                    sx={{
                      color: '#F97316',
                      fontWeight: 700,
                      p: 0,
                      fontSize: '0.875rem',
                      minWidth: 0,
                      '&:hover': { background: 'transparent', textDecoration: 'underline' },
                    }}
                  >
                    {w.action} →
                  </Button>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Box>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <Box
        component="section"
        aria-label="Frequently asked questions"
        sx={{ py: { xs: 8, md: 12 }, px: 3, background: '#fff' }}
      >
        <Box sx={{ maxWidth: 720, mx: 'auto' }}>
          <Typography
            component="h2"
            sx={{
              fontFamily: "'Fredoka One', cursive",
              fontSize: { xs: '1.8rem', md: '2.4rem' },
              color: '#1a1a1a',
              textAlign: 'center',
              mb: 1.5,
            }}
          >
            Common questions
          </Typography>
          <Typography
            sx={{
              color: '#666',
              textAlign: 'center',
              fontSize: '1.05rem',
              mb: 7,
              lineHeight: 1.7,
            }}
          >
            Still unsure? Reach out at{' '}
            <Box
              component="a"
              href="mailto:support@paragoneschool.com"
              sx={{ color: '#F97316', fontWeight: 600, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
            >
              support@paragoneschool.com
            </Box>
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {FAQS.map((faq) => (
              <Paper
                key={faq.q}
                elevation={0}
                sx={{
                  p: 3,
                  border: '1.5px solid #f0f0f0',
                  borderRadius: 3,
                  '&:hover': { borderColor: '#FDDCB0' },
                  transition: 'border-color 0.2s',
                }}
              >
                <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', mb: 1, color: '#1a1a1a' }}>
                  {faq.q}
                </Typography>
                <Typography sx={{ color: '#555', fontSize: '0.9rem', lineHeight: 1.7 }}>
                  {faq.a}
                </Typography>
              </Paper>
            ))}
          </Box>
        </Box>
      </Box>

      {/* ── Final CTA ─────────────────────────────────────────────────────── */}
      <Box
        component="section"
        aria-label="Get started"
        sx={{
          py: { xs: 8, md: 12 },
          px: 3,
          background: 'linear-gradient(135deg, #F97316 0%, #C2410C 100%)',
          textAlign: 'center',
        }}
      >
        <Typography
          component="h2"
          sx={{
            fontFamily: "'Fredoka One', cursive",
            fontSize: { xs: '1.8rem', md: '2.6rem' },
            color: '#fff',
            mb: 2,
          }}
        >
          Ready to transform your school?
        </Typography>
        <Typography
          sx={{
            color: 'rgba(255,255,255,0.9)',
            fontSize: '1.05rem',
            maxWidth: 480,
            mx: 'auto',
            mb: 5,
            lineHeight: 1.7,
          }}
        >
          Join schools already using Nifty to deliver better learning experiences for their
          teachers and students.
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            size="large"
            onClick={() => openModal('register')}
            sx={{
              background: '#fff',
              color: '#F97316',
              fontWeight: 700,
              px: 5,
              py: 1.5,
              fontSize: '1rem',
              boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
              '&:hover': {
                background: '#fff',
                transform: 'translateY(-2px)',
                boxShadow: '0 8px 28px rgba(0,0,0,0.28)',
              },
            }}
          >
            Register your school
          </Button>
          <Button
            variant="outlined"
            size="large"
            onClick={() => openModal('login')}
            sx={{
              borderColor: 'rgba(255,255,255,0.75)',
              color: '#fff',
              fontWeight: 700,
              px: 5,
              py: 1.5,
              fontSize: '1rem',
              '&:hover': { background: 'rgba(255,255,255,0.18)', borderColor: '#fff' },
            }}
          >
            Sign in
          </Button>
        </Box>
      </Box>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <Box
        component="footer"
        sx={{
          py: { xs: 5, md: 6 },
          px: { xs: 3, md: 6 },
          background: '#111',
        }}
      >
        <Box
          sx={{
            maxWidth: 1200,
            mx: 'auto',
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: { xs: 'center', md: 'flex-start' },
            justifyContent: 'space-between',
            gap: 4,
          }}
        >
          {/* Brand */}
          <Box sx={{ textAlign: { xs: 'center', md: 'left' } }}>
            <Typography
              sx={{
                fontFamily: "'Fredoka One', cursive",
                color: '#fff',
                fontSize: '1.4rem',
                letterSpacing: '0.02em',
                mb: 0.5,
              }}
            >
              <Box component="span" sx={{ color: '#FDE68A' }}>
                Nifty
              </Box>{' '}
              by Paragon
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', maxWidth: 220 }}>
              The smart learning platform for schools delivering technology education.
            </Typography>
          </Box>

          {/* Links */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              gap: { xs: 3, sm: 6 },
              textAlign: { xs: 'center', md: 'left' },
            }}
          >
            <Box>
              <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, mb: 1.5 }}>
                Platform
              </Typography>
              {[
                { label: 'Register a School', tab: 'register' as const },
                { label: 'Join as Individual', tab: 'individual' as const },
                { label: 'Sign In', tab: 'login' as const },
              ].map((l) => (
                <Box key={l.label} sx={{ mb: 1 }}>
                  <Box
                    component="button"
                    onClick={() => openModal(l.tab)}
                    sx={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'rgba(255,255,255,0.55)',
                      fontSize: '0.85rem',
                      p: 0,
                      '&:hover': { color: '#fff' },
                      transition: 'color 0.15s',
                    }}
                  >
                    {l.label}
                  </Box>
                </Box>
              ))}
            </Box>

            <Box>
              <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, mb: 1.5 }}>
                Support
              </Typography>
              <Box
                component="a"
                href="mailto:support@paragoneschool.com"
                sx={{
                  display: 'block',
                  color: 'rgba(255,255,255,0.55)',
                  fontSize: '0.85rem',
                  textDecoration: 'none',
                  mb: 1,
                  '&:hover': { color: '#fff' },
                  transition: 'color 0.15s',
                }}
              >
                support@paragoneschool.com
              </Box>
            </Box>
          </Box>
        </Box>

        <Box
          sx={{
            maxWidth: 1200,
            mx: 'auto',
            mt: 4,
            pt: 3,
            borderTop: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
          }}
        >
          <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.78rem' }}>
            © {new Date().getFullYear()} Paragon Shell. All rights reserved.
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.78rem' }}>
            Nifty by Paragon · Empowering tech education
          </Typography>
        </Box>
      </Box>

      <AuthModal open={modalOpen} initialTab={initialTab} onClose={handleModalClose} />
    </Box>
  );
}
