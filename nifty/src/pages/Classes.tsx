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
  Switch,
  FormControlLabel,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { classesApi } from '@/api/classes';
import { useAuthStore } from '@/store/authStore';
import { Role } from '@/constants';
import type { ClassScope } from '@/types';

export default function Classes() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const canCreate = Role.manager.includes(user?.role as never);
  const isStudent = user?.role === 'student';
  const canCreateGlobal = Role.global_scope.includes(user?.role as never);

  const [className, setClassName] = useState('');
  const [grade, setGrade] = useState('');
  const [scope, setScope] = useState<ClassScope>('org');
  const [error, setError] = useState('');

  const { data: classes = [], isLoading } = useQuery({
    queryKey: ['classes'],
    queryFn: () => classesApi.list(),
  });

  const { data: availableClasses = [], isLoading: availableLoading } = useQuery({
    queryKey: ['classes', 'available'],
    queryFn: () => classesApi.listAvailable(),
    enabled: isStudent,
  });

  const createMutation = useMutation({
    mutationFn: () => classesApi.create({ name: className, grade, scope }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      setClassName('');
      setGrade('');
      setScope('org');
      setError('');
    },
    onError: () => setError('Failed to create class'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => classesApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['classes'] }),
  });

  const subscribeMutation = useMutation({
    mutationFn: (id: string) => classesApi.subscribe(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['classes', 'available'] });
    },
  });

  const unsubscribeMutation = useMutation({
    mutationFn: (id: string) => classesApi.unsubscribe(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['classes', 'available'] });
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!className) {
      setError('Class name is required');
      return;
    }
    createMutation.mutate();
  };

  // For students, the classes list only contains ones they're enrolled in.
  // All org classes are shown; subscribed ones have their id in students[].
  const enrolledIds = new Set(
    classes.flatMap((c) => (c.students ?? []))
  );

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 0.5 }}>
        🎓 Classes
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {isStudent
          ? 'Browse and subscribe to classes to access their content'
          : 'Manage classes and unlock content for students'}
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
              {canCreateGlobal && (
                <FormControlLabel
                  control={
                    <Switch
                      checked={scope === 'global'}
                      onChange={(e) => setScope(e.target.checked ? 'global' : 'org')}
                      color="warning"
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <span>🌍 Global class</span>
                      <Typography variant="caption" color="text.secondary">
                        (any student can subscribe)
                      </Typography>
                    </Box>
                  }
                  sx={{ gridColumn: '1 / -1' }}
                />
              )}
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
        {isStudent ? 'My Classes' : 'All Classes'}
      </Typography>

      <Paper
        variant="outlined"
        sx={{ borderRadius: 3, border: '2px solid', borderColor: 'divider', overflow: 'hidden' }}
      >
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Class</TableCell>
              <TableCell>Scope</TableCell>
              <TableCell>Grade</TableCell>
              <TableCell>Teacher</TableCell>
              <TableCell>Organization</TableCell>
              <TableCell>Students</TableCell>
              <TableCell>Content</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={8}>
                    <Skeleton height={40} />
                  </TableCell>
                </TableRow>
              ))
            ) : classes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                    <Typography sx={{ fontSize: '3rem', mb: 1 }}>🏫</Typography>
                    <Typography>
                      {isStudent ? 'No classes available yet.' : 'No classes yet.'}
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              classes.map((c) => {
                const enrolled = enrolledIds.has(c.id) || (c.students ?? []).includes(user?.id ?? '');
                return (
                  <TableRow
                    key={c.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/app/classes/${c.id}`)}
                  >
                    <TableCell>
                      <Typography fontWeight={700}>{c.name}</Typography>
                    </TableCell>
                    <TableCell>
                      {c.scope === 'global' ? (
                        <Chip
                          label="🌍 Global"
                          size="small"
                          sx={{ background: '#FEF3C7', color: '#92400E', fontWeight: 700 }}
                        />
                      ) : (
                        <Chip
                          label="🏫 Org"
                          size="small"
                          variant="outlined"
                          sx={{ fontWeight: 700, color: 'text.secondary' }}
                        />
                      )}
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
                    <TableCell>📚 {c.content_count}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Button
                          size="small"
                          variant="outlined"
                          sx={{ borderRadius: 50, fontSize: '0.78rem' }}
                          onClick={() => navigate(`/app/classes/${c.id}`)}
                        >
                          View
                        </Button>

                        {isStudent && (
                          enrolled ? (
                            <Button
                              size="small"
                              color="error"
                              variant="outlined"
                              sx={{ borderRadius: 50, fontSize: '0.78rem' }}
                              onClick={() => unsubscribeMutation.mutate(c.id)}
                              disabled={unsubscribeMutation.isPending}
                            >
                              Unsubscribe
                            </Button>
                          ) : (
                            <Button
                              size="small"
                              color="secondary"
                              variant="contained"
                              sx={{ borderRadius: 50, fontSize: '0.78rem' }}
                              onClick={() => subscribeMutation.mutate(c.id)}
                              disabled={subscribeMutation.isPending}
                            >
                              Subscribe
                            </Button>
                          )
                        )}

                        {canCreate && (
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
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Paper>

      {/* Available classes for students */}
      {isStudent && (
        <>
          <Typography
            sx={{ fontFamily: "'Fredoka One', cursive", fontSize: '1.2rem', mt: 4, mb: 2 }}
          >
            🔓 Available Classes
          </Typography>
          <Paper
            variant="outlined"
            sx={{ borderRadius: 3, border: '2px solid', borderColor: 'divider', overflow: 'hidden' }}
          >
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Class</TableCell>
                  <TableCell>Scope</TableCell>
                  <TableCell>Grade</TableCell>
                  <TableCell>Teacher</TableCell>
                  <TableCell>Organization</TableCell>
                  <TableCell>Students</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {availableLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={7}>
                        <Skeleton height={40} />
                      </TableCell>
                    </TableRow>
                  ))
                ) : availableClasses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                        <Typography sx={{ fontSize: '3rem', mb: 1 }}>🎉</Typography>
                        <Typography>You're enrolled in all available classes!</Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : (
                  availableClasses.map((c) => (
                    <TableRow
                      key={c.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/app/classes/${c.id}`)}
                    >
                      <TableCell>
                        <Typography fontWeight={700}>{c.name}</Typography>
                      </TableCell>
                      <TableCell>
                        {c.scope === 'global' ? (
                          <Chip
                            label="🌍 Global"
                            size="small"
                            sx={{ background: '#FEF3C7', color: '#92400E', fontWeight: 700 }}
                          />
                        ) : (
                          <Chip
                            label="🏫 Org"
                            size="small"
                            variant="outlined"
                            sx={{ fontWeight: 700, color: 'text.secondary' }}
                          />
                        )}
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
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="small"
                          color="secondary"
                          variant="contained"
                          sx={{ borderRadius: 50, fontSize: '0.78rem' }}
                          onClick={() => subscribeMutation.mutate(c.id)}
                          disabled={subscribeMutation.isPending}
                        >
                          Subscribe
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Paper>
        </>
      )}
    </Box>
  );
}
