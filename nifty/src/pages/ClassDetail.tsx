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
  Switch,
  FormControlLabel,
  LinearProgress,
  Tooltip,
  Avatar,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { classesApi } from '@/api/classes';
import { contentApi } from '@/api/content';
import { useAuthStore } from '@/store/authStore';
import { ContentEmoji, Role } from '@/constants';
import ContentViewDialog from '@/components/Content/ContentViewDialog';
import type { ClassContentDetail, Content } from '@/types';

export default function ClassDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const isManager = Role.manager.includes(user?.role as never);
  const isStudent = user?.role === 'student';
  const canViewProgress =
    user?.role === 'super_admin' ||
    user?.role === 'tutor' ||
    user?.role === 'org_admin' ||
    user?.role === 'teacher';

  const [addContentOpen, setAddContentOpen] = useState(false);
  const [selectedContentId, setSelectedContentId] = useState('');
  const [addBlocking, setAddBlocking] = useState(false);
  const [error, setError] = useState('');
  const [viewContent, setViewContent] = useState<ClassContentDetail | null>(null);

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

  const { data: progress } = useQuery({
    queryKey: ['classes', id, 'progress'],
    queryFn: () => classesApi.getProgress(id!),
    enabled: !!id && canViewProgress,
  });

  // All available content for the add-content picker (managers only)
  const { data: allContent = [] } = useQuery({
    queryKey: ['content'],
    queryFn: () => contentApi.list(),
    enabled: isManager,
  });

  const invalidateContent = () => {
    queryClient.invalidateQueries({ queryKey: ['classes', id, 'content'] });
  };

  const addContentMutation = useMutation({
    mutationFn: () => classesApi.addContent(id!, selectedContentId, addBlocking),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes', id] });
      invalidateContent();
      setAddContentOpen(false);
      setSelectedContentId('');
      setAddBlocking(false);
      setError('');
    },
    onError: () => setError('Failed to add content to class'),
  });

  const removeContentMutation = useMutation({
    mutationFn: (contentId: string) => classesApi.removeContent(id!, contentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes', id] });
      invalidateContent();
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: (data: { contentId: string; blocking?: boolean; order?: number }) =>
      classesApi.updateContentItem(id!, data.contentId, {
        blocking: data.blocking,
        order: data.order,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes', id] });
      invalidateContent();
    },
  });

  const markCompleteMutation = useMutation({
    mutationFn: (contentId: string) => classesApi.markComplete(id!, contentId),
    onSuccess: invalidateContent,
  });

  const unmarkCompleteMutation = useMutation({
    mutationFn: (contentId: string) => classesApi.unmarkComplete(id!, contentId),
    onSuccess: invalidateContent,
  });

  const removeStudentMutation = useMutation({
    mutationFn: (userId: string) => classesApi.removeStudent(id!, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes', id] });
      queryClient.invalidateQueries({ queryKey: ['classes', id, 'progress'] });
    },
  });

  // Content already in the class (to exclude from picker)
  const classContentIds = new Set(classContent.map((c: ClassContentDetail) => c.content_id));
  const availableToAdd = allContent.filter((c: Content) => !classContentIds.has(c.id));

  const isEnrolled = isStudent && (cls?.students ?? []).includes(user?.id ?? '');

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

  const isTeacher = user?.role === 'teacher' && cls.teacher === user?.id;
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
          {isStudent && !isEnrolled && (
            <Alert severity="info" sx={{ mt: 1.5, borderRadius: 2 }}>
              You are not enrolled — this is a preview of the class content.
            </Alert>
          )}
        </Box>

        {canManage && (
          <Button
            variant="contained"
            color="secondary"
            sx={{ borderRadius: 50 }}
            onClick={() => {
              setError('');
              setSelectedContentId('');
              setAddBlocking(false);
              setAddContentOpen(true);
            }}
          >
            + Add Content
          </Button>
        )}
      </Box>

      {/* Content section */}
      <Typography sx={{ fontFamily: "'Fredoka One', cursive", fontSize: '1.2rem', mb: 1.5 }}>
        Class Content
      </Typography>

      <Paper
        variant="outlined"
        sx={{ borderRadius: 3, border: '2px solid', borderColor: 'divider', overflow: 'hidden', mb: 4 }}
      >
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 40 }}>#</TableCell>
              <TableCell>Title</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Subject</TableCell>
              {canManage && <TableCell>Blocking</TableCell>}
              {isStudent && <TableCell>Status</TableCell>}
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {contentLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}><Skeleton height={40} /></TableCell>
                </TableRow>
              ))
            ) : classContent.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>
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
              classContent.map((c: ClassContentDetail, idx: number) => {
                const isFirst = idx === 0;
                const isLast = idx === classContent.length - 1;

                return (
                  <TableRow
                    key={c.content_id}
                    hover={c.accessible || canManage}
                    sx={{
                      opacity: isStudent && !c.accessible ? 0.55 : 1,
                      cursor: c.accessible || canManage ? 'pointer' : 'default',
                    }}
                    onClick={() => {
                      if (c.accessible || canManage) setViewContent(c);
                    }}
                  >
                    <TableCell>
                      <Typography variant="body2" color="text.secondary" fontWeight={700}>
                        {c.order + 1}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {isStudent && !c.accessible && (
                          <Tooltip title="Complete prior content first">
                            <span>🔒</span>
                          </Tooltip>
                        )}
                        {isStudent && c.completed && (
                          <Tooltip title="Completed">
                            <span>✅</span>
                          </Tooltip>
                        )}
                        <Box>
                          <Typography fontWeight={700}>
                            {c.emoji || ContentEmoji.to_dict()[c.type] || '📄'} {c.title}
                          </Typography>
                          {c.body && (
                            <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 280 }}>
                              {c.body}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </TableCell>

                    <TableCell>
                      <Chip label={c.type} size="small" variant="outlined" />
                    </TableCell>

                    <TableCell>{c.subject ?? '—'}</TableCell>

                    {canManage && (
                      <TableCell>
                        <Tooltip title={c.blocking ? 'Blocks next content until completed' : 'Not blocking'}>
                          <Switch
                            size="small"
                            checked={c.blocking}
                            onChange={(e) =>
                              updateItemMutation.mutate({ contentId: c.content_id, blocking: e.target.checked })
                            }
                            disabled={updateItemMutation.isPending}
                          />
                        </Tooltip>
                      </TableCell>
                    )}

                    {isStudent && (
                      <TableCell>
                        {c.completed ? (
                          <Chip label="Done" size="small" color="success" sx={{ fontWeight: 700 }} />
                        ) : c.accessible ? (
                          <Chip label="In progress" size="small" color="warning" variant="outlined" sx={{ fontWeight: 700 }} />
                        ) : (
                          <Chip label="Locked" size="small" variant="outlined" sx={{ fontWeight: 700, color: 'text.disabled' }} />
                        )}
                      </TableCell>
                    )}

                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
                        {/* View button — only for accessible content or managers */}
                        {(canManage || (isStudent && isEnrolled && c.accessible)) && (
                          <Button
                            size="small"
                            variant="outlined"
                            sx={{ borderRadius: 50, fontSize: '0.78rem' }}
                            onClick={() => setViewContent(c)}
                          >
                            View
                          </Button>
                        )}

                        {/* Student: mark complete / unmark */}
                        {isStudent && isEnrolled && c.accessible && !c.completed && (
                          <Button
                            size="small"
                            variant="contained"
                            color="success"
                            sx={{ borderRadius: 50, fontSize: '0.78rem' }}
                            onClick={() => markCompleteMutation.mutate(c.content_id)}
                            disabled={markCompleteMutation.isPending}
                          >
                            Mark Done
                          </Button>
                        )}
                        {isStudent && isEnrolled && c.completed && (
                          <Button
                            size="small"
                            variant="outlined"
                            color="inherit"
                            sx={{ borderRadius: 50, fontSize: '0.78rem' }}
                            onClick={() => unmarkCompleteMutation.mutate(c.content_id)}
                            disabled={unmarkCompleteMutation.isPending}
                          >
                            Unmark
                          </Button>
                        )}

                        {/* Manager: reorder */}
                        {canManage && (
                          <>
                            <Button
                              size="small"
                              variant="text"
                              sx={{ minWidth: 28, px: 0.5, fontSize: '0.9rem' }}
                              disabled={isFirst || updateItemMutation.isPending}
                              onClick={() =>
                                updateItemMutation.mutate({ contentId: c.content_id, order: c.order - 1 })
                              }
                            >
                              ↑
                            </Button>
                            <Button
                              size="small"
                              variant="text"
                              sx={{ minWidth: 28, px: 0.5, fontSize: '0.9rem' }}
                              disabled={isLast || updateItemMutation.isPending}
                              onClick={() =>
                                updateItemMutation.mutate({ contentId: c.content_id, order: c.order + 1 })
                              }
                            >
                              ↓
                            </Button>
                            <Button
                              size="small"
                              color="error"
                              variant="outlined"
                              sx={{ borderRadius: 50, fontSize: '0.78rem' }}
                              onClick={() => removeContentMutation.mutate(c.content_id)}
                              disabled={removeContentMutation.isPending}
                            >
                              Remove
                            </Button>
                          </>
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

      {/* Students & Progress section */}
      {canViewProgress && (
        <>
          <Divider sx={{ mb: 3 }} />
          <Typography sx={{ fontFamily: "'Fredoka One', cursive", fontSize: '1.2rem', mb: 1.5 }}>
            Students ({cls.student_count})
          </Typography>

          <Paper
            variant="outlined"
            sx={{ borderRadius: 3, border: '2px solid', borderColor: 'divider', overflow: 'hidden' }}
          >
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Student</TableCell>
                  <TableCell>Progress</TableCell>
                  {canManage && <TableCell>Actions</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {!progress || progress.students.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canManage ? 3 : 2}>
                      <Box sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>
                        <Typography>No students enrolled yet.</Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : (
                  progress.students.map((s) => {
                    const pct = progress.total_content > 0
                      ? Math.round((s.completed_count / progress.total_content) * 100)
                      : 0;
                    return (
                      <TableRow key={s.student_id}>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Avatar sx={{ width: 32, height: 32, fontSize: '0.8rem', bgcolor: 'primary.main' }}>
                              {s.student_avatar}
                            </Avatar>
                            <Typography fontWeight={600}>{s.student_name}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ minWidth: 200 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <LinearProgress
                              variant="determinate"
                              value={pct}
                              sx={{ flex: 1, height: 8, borderRadius: 4 }}
                            />
                            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                              {s.completed_count}/{s.total_count}
                            </Typography>
                          </Box>
                        </TableCell>
                        {canManage && (
                          <TableCell>
                            <Button
                              size="small"
                              color="error"
                              variant="outlined"
                              sx={{ borderRadius: 50, fontSize: '0.78rem' }}
                              onClick={() => removeStudentMutation.mutate(s.student_id)}
                              disabled={removeStudentMutation.isPending}
                            >
                              Remove
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
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
            <>
              <FormControl fullWidth sx={{ mb: 2 }}>
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
              <FormControlLabel
                control={
                  <Switch
                    checked={addBlocking}
                    onChange={(e) => setAddBlocking(e.target.checked)}
                    color="warning"
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={600}>Blocking</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Students must complete this item before accessing subsequent content
                    </Typography>
                  </Box>
                }
              />
            </>
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

      {/* Content viewer */}
      {viewContent && (
        <ContentViewDialog
          contentId={viewContent.content_id}
          onClose={() => setViewContent(null)}
          canMarkDone={isStudent && isEnrolled && viewContent.accessible}
          completed={viewContent.completed}
          onMarkComplete={() => {
            markCompleteMutation.mutate(viewContent.content_id);
            setViewContent({ ...viewContent, completed: true });
          }}
          onUnmark={() => {
            unmarkCompleteMutation.mutate(viewContent.content_id);
            setViewContent({ ...viewContent, completed: false });
          }}
          markPending={markCompleteMutation.isPending || unmarkCompleteMutation.isPending}
        />
      )}
    </Box>
  );
}
