import { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Avatar,
  Chip,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Skeleton,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/api/users';
import { orgsApi } from '@/api/organizations';
import { useAuthStore } from '@/store/authStore';
import { ROLE_LABELS } from '@/types';
import type { Role } from '@/types';

const ROLE_AVATAR_BG: Record<string, string> = {
  super_admin: 'linear-gradient(135deg,#F97316,#EA580C)',
  tutor: 'linear-gradient(135deg,#F97316,#FACC15)',
  finance: 'linear-gradient(135deg,#FACC15,#F97316)',
  org_admin: 'linear-gradient(135deg,#EA580C,#C2410C)',
  teacher: 'linear-gradient(135deg,#22C55E,#F97316)',
  student: 'linear-gradient(135deg,#F97316,#FBBF24)',
};

const ROLE_CHIP: Record<string, { bg: string; color: string }> = {
  super_admin: { bg: '#FEE2E2', color: '#991B1B' },
  tutor: { bg: '#FFEDD5', color: '#C2410C' },
  finance: { bg: '#FEF3C7', color: '#92400E' },
  org_admin: { bg: '#EDE9FE', color: '#5B21B6' },
  teacher: { bg: '#D1FAE5', color: '#065F46' },
  student: { bg: '#F1F5F9', color: '#475569' },
};

export default function Users() {
  const { user: currentUser } = useAuthStore();
  const queryClient = useQueryClient();
  const isSuperAdmin = currentUser?.role === 'super_admin';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('teacher');
  const [orgId, setOrgId] = useState('');
  const [error, setError] = useState('');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(),
  });

  const { data: orgs = [] } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => orgsApi.list(),
    enabled: isSuperAdmin,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      usersApi.create({
        name,
        email,
        password: 'password',
        role,
        org_id: isSuperAdmin ? orgId : currentUser?.org ?? '',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setName('');
      setEmail('');
      setError('');
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Failed to add user';
      setError(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) {
      setError('Name and email are required');
      return;
    }
    if (isSuperAdmin && !orgId) {
      setError('Please select an organization');
      return;
    }
    setError('');
    createMutation.mutate();
  };

  const roleOptions: Role[] = isSuperAdmin
    ? ['super_admin', 'tutor', 'finance', 'org_admin', 'teacher', 'student']
    : ['org_admin', 'teacher', 'student'];

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 0.5 }}>
        👥 User Management
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Manage {users.length} users
        {isSuperAdmin ? ' across all organizations' : ' in your organization'}
      </Typography>

      {/* Add user form */}
      <Card sx={{ mb: 3, maxWidth: 680 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h5" sx={{ mb: 2.5 }}>
            Add User
          </Typography>
          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
              {error}
            </Alert>
          )}
          <Box
            component="form"
            onSubmit={handleAdd}
            sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}
          >
            <TextField
              label="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <FormControl>
              <InputLabel>Role</InputLabel>
              <Select
                value={role}
                label="Role"
                onChange={(e) => setRole(e.target.value as Role)}
              >
                {roleOptions.map((r) => (
                  <MenuItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {isSuperAdmin ? (
              <FormControl>
                <InputLabel>Organization</InputLabel>
                <Select
                  value={orgId}
                  label="Organization"
                  onChange={(e) => setOrgId(e.target.value)}
                >
                  {orgs.map((o) => (
                    <MenuItem key={o.id} value={o.id}>
                      {o.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : (
              <Box />
            )}
            <Button
              type="submit"
              variant="contained"
              disabled={createMutation.isPending}
              sx={{ gridColumn: '1 / -1', borderRadius: 50 }}
            >
              Add User →
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Users table */}
      <Paper
        variant="outlined"
        sx={{ borderRadius: 3, border: '2px solid', borderColor: 'divider', overflow: 'hidden' }}
      >
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>User</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Organization</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={4}>
                    <Skeleton height={40} />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              users.map((u) => {
                const rc = ROLE_CHIP[u.role] ?? ROLE_CHIP.student;
                const isMe = u.id === currentUser?.id;
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar
                          sx={{
                            width: 32,
                            height: 32,
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            background: ROLE_AVATAR_BG[u.role] ?? ROLE_AVATAR_BG.student,
                          }}
                        >
                          {u.avatar}
                        </Avatar>
                        <Box>
                          <Typography fontWeight={700} fontSize="0.9rem">
                            {u.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {u.email}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={ROLE_LABELS[u.role]}
                        size="small"
                        sx={{ background: rc.bg, color: rc.color, fontWeight: 700 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={u.org_name ?? '—'}
                        size="small"
                        variant="outlined"
                        sx={{ fontWeight: 700 }}
                      />
                    </TableCell>
                    <TableCell>
                      {isMe ? (
                        <Typography variant="caption" color="text.secondary">
                          You
                        </Typography>
                      ) : (
                        <Button
                          size="small"
                          color="error"
                          variant="outlined"
                          sx={{ borderRadius: 50, fontSize: '0.78rem' }}
                          onClick={() => deleteMutation.mutate(u.id)}
                          disabled={deleteMutation.isPending}
                        >
                          Remove
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
