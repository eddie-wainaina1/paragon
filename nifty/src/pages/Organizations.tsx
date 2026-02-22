import React, { useState } from 'react';
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
  Chip,
  Paper,
  Alert,
  Skeleton,
  CircularProgress,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orgsApi } from '@/api/organizations';
import { usersApi } from '@/api/users';
import { contentApi } from '@/api/content';

export default function Organizations() {
  const queryClient = useQueryClient();
  const [orgName, setOrgName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [error, setError] = useState('');
  const [tempPassword, setTempPassword] = useState('');

  const { data: orgs = [], isLoading } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => orgsApi.list(),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(),
  });

  const { data: contentList = [] } = useQuery({
    queryKey: ['content'],
    queryFn: () => contentApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      orgsApi.create({
        name: orgName,
        ...(adminEmail ? { admin_email: adminEmail } : {}),
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setOrgName('');
      setAdminEmail('');
      setError('');
      if (created.admin_temp_password) {
        setTempPassword(created.admin_temp_password);
      }
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Failed to register organization';
      setError(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => orgsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName) {
      setError('Organization name is required');
      return;
    }
    setError('');
    setTempPassword('');
    createMutation.mutate();
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 0.5 }}>
        🏫 Organizations
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Manage all registered organizations on the platform
      </Typography>

      <Card sx={{ mb: 3, maxWidth: 680 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h5" sx={{ mb: 2.5 }}>
            Register New Organization
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          {tempPassword && (
            <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>
              Organization registered! Org admin created —{' '}
              <strong>temporary password: {tempPassword}</strong>. Share this with the admin and ask
              them to change it on first login.
            </Alert>
          )}

          <Box
            component="form"
            onSubmit={handleAdd}
            sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}
          >
            <TextField
              label="Organization Name"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="School Name"
              required
            />
            <TextField
              label="Admin Email (optional)"
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="admin@school.edu"
            />
            <Button
              type="submit"
              variant="contained"
              disabled={createMutation.isPending}
              startIcon={createMutation.isPending ? <CircularProgress size={16} color="inherit" /> : null}
              sx={{ gridColumn: '1 / -1', borderRadius: 50 }}
            >
              Register Organization →
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Paper
        variant="outlined"
        sx={{ borderRadius: 3, border: '2px solid', borderColor: 'divider', overflow: 'hidden' }}
      >
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Organization</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Users</TableCell>
              <TableCell>Content</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5}>
                    <Skeleton height={40} />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              orgs.map((o) => {
                const userCount = users.filter((u) => u.org === o.id).length;
                const contentCount = contentList.filter((c) => c.org === o.id).length;
                const isPlatform = o.type === 'platform';
                return (
                  <TableRow key={o.id}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography fontWeight={700}>{o.name}</Typography>
                        {isPlatform && (
                          <Chip
                            label="Platform"
                            size="small"
                            sx={{ background: '#FEF3C7', color: '#92400E', fontWeight: 700 }}
                          />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={o.type}
                        size="small"
                        sx={{
                          background: isPlatform ? '#FEE2E2' : '#D1FAE5',
                          color: isPlatform ? '#991B1B' : '#065F46',
                          fontWeight: 700,
                        }}
                      />
                    </TableCell>
                    <TableCell>👥 {userCount}</TableCell>
                    <TableCell>📚 {contentCount}</TableCell>
                    <TableCell>
                      {!isPlatform && (
                        <Button
                          size="small"
                          color="error"
                          variant="outlined"
                          sx={{ borderRadius: 50, fontSize: '0.78rem' }}
                          onClick={() => deleteMutation.mutate(o.id)}
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
