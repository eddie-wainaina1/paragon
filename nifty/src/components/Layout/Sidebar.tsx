import { Box, Typography, Button, useTheme } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import LibraryBooksOutlinedIcon from '@mui/icons-material/LibraryBooksOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import { useAuthStore } from '@/store/authStore';
import { Role } from '@/constants';
import type { Role as RoleType } from '@/types';

interface NavItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  path: string;
}

interface NavSection {
  section: string;
  items: NavItem[];
}

function getNavSections(role: RoleType, orgId?: string): NavSection[] {
  const isStudent = role === 'student';

  const generalItems: NavItem[] = [
    { id: 'dashboard', icon: <DashboardOutlinedIcon fontSize="small" />, label: 'Dashboard', path: '/app/dashboard' },
  ];
  if (!isStudent) {
    generalItems.push({ id: 'content_browse', icon: <LibraryBooksOutlinedIcon fontSize="small" />, label: 'Content Library', path: '/app/content' });
  }

  const sections: NavSection[] = [{ section: 'General', items: generalItems }];

  if ((Role.creator as readonly string[]).includes(role)) {
    sections.push({
      section: 'Content',
      items: [
        { id: 'content_create', icon: <EditOutlinedIcon fontSize="small" />, label: 'Create Content', path: '/app/content/create' },
        { id: 'my_content', icon: <FolderOutlinedIcon fontSize="small" />, label: 'My Content', path: '/app/my-content' },
      ],
    });
  }

  if (isStudent) {
    sections.push({
      section: 'Classes',
      items: [{ id: 'classes', icon: <SchoolOutlinedIcon fontSize="small" />, label: 'My Classes', path: '/app/classes' }],
    });
  } else if ((Role.manager as readonly string[]).includes(role)) {
    sections.push({
      section: 'Classes',
      items: [
        { id: 'classes', icon: <SchoolOutlinedIcon fontSize="small" />, label: 'Classes', path: '/app/classes' },
      ],
    });
  }

  if ((Role.admin as readonly string[]).includes(role)) {
    const mgmtItems: NavItem[] = [
      { id: 'users', icon: <GroupOutlinedIcon fontSize="small" />, label: 'Users', path: '/app/users' },
    ];
    if (role === 'super_admin') {
      mgmtItems.push({
        id: 'organizations',
        icon: <BusinessOutlinedIcon fontSize="small" />,
        label: 'Organizations',
        path: '/app/organizations',
      });
    }
    sections.push({ section: 'Management', items: mgmtItems });
  }

  // Finance and super_admin see the subscriptions overview
  if (role === 'finance' || role === 'super_admin') {
    sections.push({
      section: 'Billing',
      items: [
        { id: 'subscriptions', icon: <CreditCardOutlinedIcon fontSize="small" />, label: 'Subscriptions', path: '/app/subscriptions' },
      ],
    });
  }

  // org_admin can manage their own org's subscription
  if (role === 'org_admin' && orgId) {
    sections.push({
      section: 'Billing',
      items: [
        {
          id: 'org_subscription',
          icon: <CreditCardOutlinedIcon fontSize="small" />,
          label: 'Subscription',
          path: `/app/subscriptions/orgs/${orgId}`,
        },
      ],
    });
  }

  // Individual students can manage their own subscription
  if (role === 'student') {
    sections.push({
      section: 'Billing',
      items: [
        { id: 'my_subscription', icon: <CreditCardOutlinedIcon fontSize="small" />, label: 'My Subscription', path: '/app/my-subscription' },
      ],
    });
  }

  sections.push({
    section: 'Account',
    items: [{ id: 'profile', icon: <SettingsOutlinedIcon fontSize="small" />, label: 'Settings', path: '/app/profile' }],
  });

  return sections;
}

export default function Sidebar() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  if (!user) return null;

  const sections = getNavSections(user.role, user.org);

  const activeItemBg = isDark ? 'rgba(249,115,22,0.18)' : '#FFEDD5';
  const hoverBg = isDark ? 'rgba(249,115,22,0.08)' : '#FFF7ED';

  return (
    <Box
      component="nav"
      sx={{
        width: 230,
        flexShrink: 0,
        bgcolor: 'background.paper',
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
              fontWeight: 700,
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
                  background: active ? activeItemBg : 'transparent',
                  '&:hover': {
                    background: active ? activeItemBg : hoverBg,
                    color: active ? 'primary.main' : 'text.primary',
                  },
                }}
              >
                <Box component="span" sx={{ display: 'flex', alignItems: 'center', width: 22, flexShrink: 0 }}>
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
