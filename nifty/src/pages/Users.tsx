import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { authApi } from '@/api/auth';
import { useAuthStore } from '@/store/authStore';
import { Role, RoleStyle } from '@/constants';
import type { Role as RoleType } from '@/types';

export default function Users() {
  const { user: currentUser, impersonate } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isSuperAdmin = currentUser?.role === Role.super_admin;

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<RoleType>('teacher');
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
        password,
        role,
        org_id: isSuperAdmin ? orgId : currentUser?.org ?? '',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setName('');
      setEmail('');
      setPassword('');
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

  const impersonateMutation = useMutation({
    mutationFn: (userId: string) => authApi.impersonate(userId),
    onSuccess: (data) => {
      impersonate(data.user, data.access_token);
      navigate('/app/dashboard');
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Failed to impersonate user';
      setError(msg);
    },
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setError('Name, email, and password are required');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (isSuperAdmin && !orgId) {
      setError('Please select an organization');
      return;
    }
    setError('');
    createMutation.mutate();
  };

  const roleOptions = isSuperAdmin ? Role.all : Role.org_roles;

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
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              slotProps={{ htmlInput: { minLength: 6 } }}
            />
            <FormControl>
              <InputLabel>Role</InputLabel>
              <Select
                value={role}
                label="Role"
                onChange={(e) => setRole(e.target.value as RoleType)}
              >
                {roleOptions.map((r) => (
                  <MenuItem key={r} value={r}>
                    {Role.to_dict()[r]}
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
                const rc = RoleStyle.chip[u.role] ?? RoleStyle.chip.student;
                const isMe = u.id === currentUser?.id;
                const canImpersonate = isSuperAdmin && !isMe && u.role !== Role.super_admin;
                return (
                  <TableRow
                    key={u.id}
                    onClick={() => navigate(`/app/users/${u.id}`)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar
                          sx={{
                            width: 32,
                            height: 32,
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            background: RoleStyle.avatar_bg[u.role] ?? RoleStyle.avatar_bg.student,
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
                        label={Role.to_dict()[u.role]}
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
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {isMe ? (
                        <Typography variant="caption" color="text.secondary">
                          You
                        </Typography>
                      ) : (
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          {canImpersonate && (
                            <Button
                              size="small"
                              variant="outlined"
                              color="secondary"
                              sx={{ borderRadius: 50, fontSize: '0.78rem' }}
                              onClick={() => impersonateMutation.mutate(u.id)}
                              disabled={impersonateMutation.isPending}
                            >
                              Impersonate
                            </Button>
                          )}
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
                        </Box>
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
