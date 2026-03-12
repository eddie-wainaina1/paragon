import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Avatar,
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Skeleton,
  Divider,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/api/users';
import { useAuthStore } from '@/store/authStore';
import { Role, RoleStyle } from '@/constants';
import type { Role as RoleType } from '@/types';

export default function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthStore();
  const isSuperAdmin = currentUser?.role === Role.super_admin;
  const isOrgAdmin = currentUser?.role === Role.org_admin;

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<RoleType>('student');
  const [error, setError] = useState('');

  const { data: user, isLoading } = useQuery({
    queryKey: ['user', id],
    queryFn: () => usersApi.getById(id!),
    enabled: !!id,
  });

  const canEdit =
    !!user &&
    (isSuperAdmin || (isOrgAdmin && user.org === currentUser?.org));

  const roleOptions = isSuperAdmin ? Role.all : Role.org_roles;

  function startEdit() {
    setName(user!.name);
    setEmail(user!.email);
    setPassword('');
    setRole(user!.role);
    setError('');
    setEditing(true);
  }

  const updateMutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, string> = {};
      if (name !== user?.name) payload.name = name;
      if (email !== user?.email) payload.email = email;
      if (password) payload.password = password;
      if (role !== user?.role) payload.role = role;
      return usersApi.update(id!, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', id] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setEditing(false);
      setError('');
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Failed to update user';
      setError(msg);
    },
  });

  if (isLoading) {
    return (
      <Box>
        <Skeleton width={120} height={36} sx={{ mb: 3 }} />
        <Skeleton width={300} height={60} sx={{ mb: 2 }} />
        <Skeleton height={200} />
      </Box>
    );
  }

  if (!user) {
    return (
      <Box>
        <Button onClick={() => navigate('/app/users')} sx={{ mb: 2 }}>
          ← Users
        </Button>
        <Alert severity="error">User not found</Alert>
      </Box>
    );
  }

  const rc = RoleStyle.chip[user.role] ?? RoleStyle.chip.student;

  return (
    <Box>
      <Button onClick={() => navigate('/app/users')} sx={{ mb: 3, borderRadius: 50 }}>
        ← Users
      </Button>

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Avatar
          sx={{
            width: 56,
            height: 56,
            fontSize: '1.4rem',
            fontWeight: 800,
            background: RoleStyle.avatar_bg[user.role] ?? RoleStyle.avatar_bg.student,
          }}
        >
          {user.avatar}
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4">{user.name}</Typography>
          <Typography color="text.secondary">{user.email}</Typography>
        </Box>
        <Chip label={Role.to_dict()[user.role]} sx={{ background: rc.bg, color: rc.color, fontWeight: 700 }} />
        {!user.verified && (
          <Chip label="Unverified" size="small" color="warning" />
        )}
      </Box>

      <Card>
        <CardContent sx={{ p: 3 }}>
          {!editing ? (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h5">Details</Typography>
                {canEdit && (
                  <Button variant="outlined" onClick={startEdit} sx={{ borderRadius: 50 }}>
                    Edit
                  </Button>
                )}
              </Box>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Organization
                  </Typography>
                  <Typography>{user.org_name}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Email Verified
                  </Typography>
                  <Typography>{user.verified ? 'Yes' : 'No'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Member Since
                  </Typography>
                  <Typography>{new Date(user.created_at).toLocaleDateString()}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Terms Accepted
                  </Typography>
                  <Typography>
                    {user.terms_accepted_at
                      ? new Date(user.terms_accepted_at).toLocaleDateString()
                      : '—'}
                  </Typography>
                </Box>
              </Box>
            </Box>
          ) : (
            <Box>
              <Typography variant="h5" sx={{ mb: 2 }}>
                Edit User
              </Typography>
              {error && (
                <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                  {error}
                </Alert>
              )}
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <TextField
                  label="Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <TextField
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <TextField
                  label="New Password (optional)"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
                <Button
                  variant="contained"
                  onClick={() => updateMutation.mutate()}
                  disabled={updateMutation.isPending}
                  sx={{ borderRadius: 50 }}
                >
                  Save Changes
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => setEditing(false)}
                  disabled={updateMutation.isPending}
                  sx={{ borderRadius: 50 }}
                >
                  Cancel
                </Button>
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
