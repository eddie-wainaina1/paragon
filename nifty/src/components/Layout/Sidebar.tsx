import { Box, Typography, Button } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import type { Role } from '@/types';

interface NavItem {
  id: string;
  icon: string;
  label: string;
  path: string;
}

interface NavSection {
  section: string;
  items: NavItem[];
}

function getNavSections(role: Role): NavSection[] {
  const sections: NavSection[] = [
    {
      section: 'General',
      items: [
        { id: 'dashboard', icon: '🏠', label: 'Dashboard', path: '/app/dashboard' },
        { id: 'content_browse', icon: '📚', label: 'Content Library', path: '/app/content' },
      ],
    },
  ];

  if (['super_admin', 'tutor', 'teacher', 'org_admin'].includes(role)) {
    sections.push({
      section: 'Content',
      items: [
        { id: 'content_create', icon: '✏️', label: 'Create Content', path: '/app/content/create' },
        { id: 'my_content', icon: '🗂️', label: 'My Content', path: '/app/my-content' },
      ],
    });
  }

  if (['super_admin', 'org_admin', 'teacher'].includes(role)) {
    sections.push({
      section: 'Classes',
      items: [
        { id: 'classes', icon: '🎓', label: 'Classes', path: '/app/classes' },
      ],
    });
  }

  if (['super_admin', 'org_admin'].includes(role)) {
    const mgmtItems: NavItem[] = [
      { id: 'users', icon: '👥', label: 'Users', path: '/app/users' },
    ];
    if (role === 'super_admin') {
      mgmtItems.push({
        id: 'organizations',
        icon: '🏫',
        label: 'Organizations',
        path: '/app/organizations',
      });
    }
    sections.push({ section: 'Management', items: mgmtItems });
  }

  sections.push({
    section: 'Account',
    items: [{ id: 'profile', icon: '⚙️', label: 'Settings', path: '/app/profile' }],
  });

  return sections;
}

export default function Sidebar() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  if (!user) return null;

  const sections = getNavSections(user.role);

  return (
    <Box
      component="nav"
      sx={{
        width: 230,
        flexShrink: 0,
        background: '#fff',
        borderRight: '2px solid',
        borderColor: 'divider',
        display: { xs: 'none', md: 'flex' },
        flexDirection: 'column',
        p: '16px 10px',
        gap: '4px',
        overflowY: 'auto',
      }}
    >
      {sections.map((sec) => (
        <Box key={sec.section}>
          <Typography
            sx={{
              fontSize: '0.68rem',
              fontWeight: 800,
              color: 'text.secondary',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              px: 1.5,
              py: 0.5,
              mt: 1,
            }}
          >
            {sec.section}
          </Typography>
          {sec.items.map((item) => {
            const active = pathname === item.path || pathname.startsWith(item.path + '/');
            return (
              <Button
                key={item.id}
                onClick={() => navigate(item.path)}
                fullWidth
                sx={{
                  justifyContent: 'flex-start',
                  gap: 1.25,
                  px: 1.75,
                  py: 1.1,
                  borderRadius: 2,
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  color: active ? 'primary.main' : 'text.secondary',
                  background: active
                    ? 'linear-gradient(135deg,#FFEDD5,#FEF3C7)'
                    : 'transparent',
                  '&:hover': {
                    background: active ? 'linear-gradient(135deg,#FFEDD5,#FEF3C7)' : '#FFF7ED',
                    color: active ? 'primary.main' : 'text.primary',
                  },
                }}
              >
                <Box component="span" sx={{ fontSize: '1.1rem', width: 22, textAlign: 'center' }}>
                  {item.icon}
                </Box>
                {item.label}
              </Button>
            );
          })}
        </Box>
      ))}
    </Box>
  );
}
