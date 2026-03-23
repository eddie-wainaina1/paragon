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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
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

  const [inviteDialog, setInviteDialog] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [inviteSent, setInviteSent] = useState(false);

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

  const resendMutation = useMutation({
    mutationFn: () => {
      const payload: { name?: string; email?: string; password?: string } = {};
      if (inviteName !== user?.name) payload.name = inviteName;
      if (inviteEmail !== user?.email) payload.email = inviteEmail;
      if (invitePassword) payload.password = invitePassword;
      return usersApi.resendInvite(id!, payload);
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['user', id] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setInviteSent(true);
      setInviteError('');
      // Update displayed data optimistically via query cache
      queryClient.setQueryData(['user', id], updated);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Failed to resend invite';
      setInviteError(msg);
    },
  });

  function openInviteDialog() {
    setInviteName(user!.name);
    setInviteEmail(user!.email);
    setInvitePassword('');
    setInviteError('');
    setInviteSent(false);
    setInviteDialog(true);
  }

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
        {!user.verified && canEdit && (
          <Button variant="outlined" size="small" onClick={openInviteDialog} sx={{ borderRadius: 50 }}>
            Resend Invite
          </Button>
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

      {/* Resend Invite dialog */}
      <Dialog open={inviteDialog} onClose={() => !resendMutation.isPending && setInviteDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Resend Invite</DialogTitle>
        <DialogContent>
          {inviteSent ? (
            <Alert severity="success" sx={{ mt: 1, borderRadius: 2 }}>
              Invite sent to {inviteEmail}.
            </Alert>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Update details if needed, then resend the verification email.
              </Typography>
              {inviteError && (
                <Alert severity="error" sx={{ borderRadius: 2 }}>{inviteError}</Alert>
              )}
              <TextField
                label="Full Name"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                size="small"
                fullWidth
              />
              <TextField
                label="Email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                size="small"
                fullWidth
              />
              <TextField
                label="New Password (optional)"
                type="password"
                value={invitePassword}
                onChange={(e) => setInvitePassword(e.target.value)}
                size="small"
                fullWidth
                helperText="Leave blank to keep the existing password"
                slotProps={{ htmlInput: { minLength: 6 } }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          {inviteSent ? (
            <Button onClick={() => setInviteDialog(false)} variant="contained" sx={{ borderRadius: 50 }}>
              Done
            </Button>
          ) : (
            <>
              <Button onClick={() => setInviteDialog(false)} disabled={resendMutation.isPending} sx={{ borderRadius: 50 }}>
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={() => resendMutation.mutate()}
                disabled={resendMutation.isPending}
                sx={{ borderRadius: 50 }}
              >
                Send Invite
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
