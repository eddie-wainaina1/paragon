import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Chip,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Alert,
  Skeleton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { classesApi } from '@/api/classes';
import { contentApi } from '@/api/content';
import { useAuthStore } from '@/store/authStore';
import { ContentEmoji, Role } from '@/constants';
import type { Content } from '@/types';

export default function ClassDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const isManager = Role.manager.includes(user?.role as never);

  const [addContentOpen, setAddContentOpen] = useState(false);
  const [selectedContentId, setSelectedContentId] = useState('');
  const [error, setError] = useState('');

  const { data: cls, isLoading: clsLoading } = useQuery({
    queryKey: ['classes', id],
    queryFn: () => classesApi.get(id!),
    enabled: !!id,
  });

  const { data: classContent = [], isLoading: contentLoading } = useQuery({
    queryKey: ['classes', id, 'content'],
    queryFn: () => classesApi.getContent(id!),
    enabled: !!id,
  });

  // All available content for the add-content picker (managers only)
  const { data: allContent = [] } = useQuery({
    queryKey: ['content'],
    queryFn: () => contentApi.list(),
    enabled: isManager,
  });

  const addContentMutation = useMutation({
    mutationFn: () => classesApi.addContent(id!, selectedContentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes', id] });
      queryClient.invalidateQueries({ queryKey: ['classes', id, 'content'] });
      setAddContentOpen(false);
      setSelectedContentId('');
      setError('');
    },
    onError: () => setError('Failed to add content to class'),
  });

  const removeContentMutation = useMutation({
    mutationFn: (contentId: string) => classesApi.removeContent(id!, contentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes', id] });
      queryClient.invalidateQueries({ queryKey: ['classes', id, 'content'] });
    },
  });

  const removeStudentMutation = useMutation({
    mutationFn: (userId: string) => classesApi.removeStudent(id!, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['classes', id] }),
  });

  // Content already in the class (to exclude from picker)
  const classContentIds = new Set(cls?.unlocked_content ?? []);
  const availableToAdd = allContent.filter((c: Content) => !classContentIds.has(c.id));

  if (clsLoading) {
    return (
      <Box>
        <Skeleton height={48} width={300} />
        <Skeleton height={24} width={200} sx={{ mt: 1 }} />
        <Skeleton height={200} sx={{ mt: 3 }} />
      </Box>
    );
  }

  if (!cls) {
    return (
      <Box>
        <Alert severity="error">Class not found.</Alert>
        <Button sx={{ mt: 2 }} onClick={() => navigate('/app/classes')}>
          Back to Classes
        </Button>
      </Box>
    );
  }

  const isTeacher = user?.role === 'teacher' && cls.teacher === user.id;
  const canManage = user?.role === 'super_admin' || user?.role === 'org_admin' || isTeacher;

  return (
    <Box>
      {/* Header */}
      <Button
        variant="text"
        size="small"
        onClick={() => navigate('/app/classes')}
        sx={{ mb: 1, color: 'text.secondary' }}
      >
        ← Back to Classes
      </Button>

      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ mb: 0.5 }}>
            🎓 {cls.name}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {cls.grade && (
              <Chip
                label={cls.grade}
                size="small"
                sx={{ background: '#FFEDD5', color: '#C2410C', fontWeight: 700 }}
              />
            )}
            <Chip label={cls.org_name ?? '—'} size="small" variant="outlined" sx={{ fontWeight: 700 }} />
            <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>
              Teacher: {cls.teacher_name ?? '—'}
            </Typography>
          </Box>
        </Box>

        {canManage && (
          <Button
            variant="contained"
            color="secondary"
            sx={{ borderRadius: 50 }}
            onClick={() => {
              setError('');
              setSelectedContentId('');
              setAddContentOpen(true);
            }}
          >
            + Add Content
          </Button>
        )}
      </Box>

      {/* Content section */}
      <Typography
        sx={{ fontFamily: "'Fredoka One', cursive", fontSize: '1.2rem', mb: 1.5 }}
      >
        Class Content
      </Typography>

      <Paper
        variant="outlined"
        sx={{ borderRadius: 3, border: '2px solid', borderColor: 'divider', overflow: 'hidden', mb: 4 }}
      >
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Title</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Subject</TableCell>
              <TableCell>Author</TableCell>
              {canManage && <TableCell>Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {contentLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5}><Skeleton height={40} /></TableCell>
                </TableRow>
              ))
            ) : classContent.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                    <Typography sx={{ fontSize: '2.5rem', mb: 1 }}>📭</Typography>
                    <Typography>No content in this class yet.</Typography>
                    {canManage && (
                      <Typography variant="body2" sx={{ mt: 0.5 }}>
                        Use "Add Content" to assign existing content to this class.
                      </Typography>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              classContent.map((c: Content) => (
                <TableRow key={c.id} hover>
                  <TableCell>
                    <Typography fontWeight={700}>
                      {c.emoji || ContentEmoji.to_dict()[c.type] || '📄'} {c.title}
                    </Typography>
                    {c.body && (
                      <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 300 }}>
                        {c.body}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip label={c.type} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>{c.subject ?? '—'}</TableCell>
                  <TableCell>{c.author_name ?? '—'}</TableCell>
                  {canManage && (
                    <TableCell>
                      <Button
                        size="small"
                        color="error"
                        variant="outlined"
                        sx={{ borderRadius: 50, fontSize: '0.78rem' }}
                        onClick={() => removeContentMutation.mutate(c.id)}
                        disabled={removeContentMutation.isPending}
                      >
                        Remove
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Paper>

      {/* Students section (managers only) */}
      {canManage && (
        <>
          <Divider sx={{ mb: 3 }} />
          <Typography
            sx={{ fontFamily: "'Fredoka One', cursive", fontSize: '1.2rem', mb: 1.5 }}
          >
            Students ({cls.student_count})
          </Typography>

          <Paper
            variant="outlined"
            sx={{ borderRadius: 3, border: '2px solid', borderColor: 'divider', overflow: 'hidden' }}
          >
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Student ID</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(cls.students ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2}>
                      <Box sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>
                        <Typography>No students enrolled yet.</Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : (
                  (cls.students ?? []).map((sid) => (
                    <TableRow key={sid}>
                      <TableCell>
                        <Typography fontFamily="monospace">{sid}</Typography>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          color="error"
                          variant="outlined"
                          sx={{ borderRadius: 50, fontSize: '0.78rem' }}
                          onClick={() => removeStudentMutation.mutate(sid)}
                          disabled={removeStudentMutation.isPending}
                        >
                          Remove
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

      {/* Add Content Dialog */}
      <Dialog open={addContentOpen} onClose={() => setAddContentOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add Content to Class</DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
              {error}
            </Alert>
          )}
          {availableToAdd.length === 0 ? (
            <Alert severity="info">
              All available content has already been added to this class.
            </Alert>
          ) : (
            <FormControl fullWidth>
              <InputLabel>Select Content</InputLabel>
              <Select
                value={selectedContentId}
                label="Select Content"
                onChange={(e) => setSelectedContentId(e.target.value)}
              >
                {availableToAdd.map((c: Content) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.emoji || ContentEmoji.to_dict()[c.type] || '📄'} {c.title}
                    {c.subject && ` — ${c.subject}`}
                    {c.scope === 'global' && (
                      <Chip label="global" size="small" sx={{ ml: 1 }} />
                    )}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setAddContentOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="secondary"
            disabled={!selectedContentId || addContentMutation.isPending}
            onClick={() => addContentMutation.mutate()}
          >
            Add to Class
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
