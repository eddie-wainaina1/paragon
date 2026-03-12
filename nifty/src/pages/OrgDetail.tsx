import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Chip,
  TextField,
  Alert,
  Skeleton,
  Divider,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orgsApi } from '@/api/organizations';
import { useAuthStore } from '@/store/authStore';
import { Role } from '@/constants';

export default function OrgDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthStore();
  const isSuperAdmin = currentUser?.role === Role.super_admin;

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const { data: org, isLoading } = useQuery({
    queryKey: ['organization', id],
    queryFn: () => orgsApi.getById(id!),
    enabled: !!id,
  });

  function startEdit() {
    setName(org!.name);
    setError('');
    setEditing(true);
  }

  const updateMutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, string> = {};
      if (name !== org?.name) payload.name = name;
      return orgsApi.update(id!, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', id] });
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      setEditing(false);
      setError('');
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Failed to update organization';
      setError(msg);
    },
  });

  if (isLoading) {
    return (
      <Box>
        <Skeleton width={180} height={36} sx={{ mb: 3 }} />
        <Skeleton width={320} height={60} sx={{ mb: 2 }} />
        <Skeleton height={200} />
      </Box>
    );
  }

  if (!org) {
    return (
      <Box>
        <Button onClick={() => navigate('/app/organizations')} sx={{ mb: 2 }}>
          ← Organizations
        </Button>
        <Alert severity="error">Organization not found</Alert>
      </Box>
    );
  }

  const isPlatform = org.type === 'platform';

  return (
    <Box>
      <Button onClick={() => navigate('/app/organizations')} sx={{ mb: 3, borderRadius: 50 }}>
        ← Organizations
      </Button>

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <Typography variant="h4">{org.name}</Typography>
            {isPlatform && (
              <Chip
                label="Platform"
                size="small"
                sx={{ background: '#FEF3C7', color: '#92400E', fontWeight: 700 }}
              />
            )}
            {org.internal && (
              <Chip
                label="Internal"
                size="small"
                sx={{ background: '#EDE9FE', color: '#5B21B6', fontWeight: 700 }}
              />
            )}
          </Box>
          <Typography color="text.secondary">/{org.slug}</Typography>
        </Box>
        <Chip
          label={org.type}
          sx={{
            background: isPlatform ? '#FEE2E2' : '#D1FAE5',
            color: isPlatform ? '#991B1B' : '#065F46',
            fontWeight: 700,
          }}
        />
      </Box>

      <Card>
        <CardContent sx={{ p: 3 }}>
          {!editing ? (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h5">Details</Typography>
                {isSuperAdmin && (
                  <Button variant="outlined" onClick={startEdit} sx={{ borderRadius: 50 }}>
                    Edit
                  </Button>
                )}
              </Box>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Name
                  </Typography>
                  <Typography>{org.name}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Slug
                  </Typography>
                  <Typography>{org.slug}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Type
                  </Typography>
                  <Typography sx={{ textTransform: 'capitalize' }}>{org.type}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Created
                  </Typography>
                  <Typography>{new Date(org.created_at).toLocaleDateString()}</Typography>
                </Box>
              </Box>
            </Box>
          ) : (
            <Box>
              <Typography variant="h5" sx={{ mb: 2 }}>
                Edit Organization
              </Typography>
              {error && (
                <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                  {error}
                </Alert>
              )}
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <TextField
                  label="Organization Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  sx={{ gridColumn: '1 / -1' }}
                />
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
