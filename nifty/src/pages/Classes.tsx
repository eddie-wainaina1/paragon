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
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { classesApi } from '@/api/classes';
import { useAuthStore } from '@/store/authStore';

export default function Classes() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const canCreate = ['super_admin', 'org_admin', 'teacher'].includes(user?.role ?? '');

  const [className, setClassName] = useState('');
  const [grade, setGrade] = useState('');
  const [error, setError] = useState('');

  const { data: classes = [], isLoading } = useQuery({
    queryKey: ['classes'],
    queryFn: () => classesApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: () => classesApi.create({ name: className, grade }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      setClassName('');
      setGrade('');
      setError('');
    },
    onError: () => setError('Failed to create class'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => classesApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['classes'] }),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!className) {
      setError('Class name is required');
      return;
    }
    createMutation.mutate();
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 0.5 }}>
        🎓 Classes
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Manage classes and unlock content for students
      </Typography>

      {canCreate && (
        <Card sx={{ mb: 3, maxWidth: 620 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h5" sx={{ mb: 2.5 }}>
              Create New Class
            </Typography>
            {error && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                {error}
              </Alert>
            )}
            <Box
              component="form"
              onSubmit={handleCreate}
              sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}
            >
              <TextField
                label="Class Name"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="e.g. Grade 5 — Tech Explorers"
                required
              />
              <TextField
                label="Grade / Level"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                placeholder="e.g. Grade 5"
              />
              <Button
                type="submit"
                variant="contained"
                color="secondary"
                disabled={createMutation.isPending}
                sx={{ gridColumn: '1 / -1', borderRadius: 50 }}
              >
                Create Class ✓
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      <Typography
        sx={{ fontFamily: "'Fredoka One', cursive", fontSize: '1.2rem', mb: 2 }}
      >
        All Classes
      </Typography>

      <Paper
        variant="outlined"
        sx={{ borderRadius: 3, border: '2px solid', borderColor: 'divider', overflow: 'hidden' }}
      >
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Class</TableCell>
              <TableCell>Grade</TableCell>
              <TableCell>Teacher</TableCell>
              <TableCell>Organization</TableCell>
              <TableCell>Students</TableCell>
              {canCreate && <TableCell>Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}>
                    <Skeleton height={40} />
                  </TableCell>
                </TableRow>
              ))
            ) : classes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                    <Typography sx={{ fontSize: '3rem', mb: 1 }}>🏫</Typography>
                    <Typography>No classes yet.</Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              classes.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Typography fontWeight={700}>{c.name}</Typography>
                  </TableCell>
                  <TableCell>
                    {c.grade && (
                      <Chip
                        label={c.grade}
                        size="small"
                        sx={{ background: '#FFEDD5', color: '#C2410C', fontWeight: 700 }}
                      />
                    )}
                  </TableCell>
                  <TableCell>{c.teacher_name ?? '—'}</TableCell>
                  <TableCell>
                    <Chip
                      label={c.org_name ?? '—'}
                      size="small"
                      variant="outlined"
                      sx={{ fontWeight: 700 }}
                    />
                  </TableCell>
                  <TableCell>👤 {c.student_count}</TableCell>
                  {canCreate && (
                    <TableCell>
                      <Button
                        size="small"
                        color="error"
                        variant="outlined"
                        sx={{ borderRadius: 50, fontSize: '0.78rem' }}
                        onClick={() => deleteMutation.mutate(c.id)}
                        disabled={deleteMutation.isPending}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
