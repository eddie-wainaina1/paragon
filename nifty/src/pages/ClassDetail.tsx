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
  TextField,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { classesApi } from '@/api/classes';
import { contentApi } from '@/api/content';
import { useAuthStore } from '@/store/authStore';
import { ContentEmoji, Role } from '@/constants';
import ContentViewDialog from '@/components/Content/ContentViewDialog';
import type { ClassContentDetail, Content } from '@/types';

// ── Attempt settings dialog (manager only) ────────────────────────────────────

interface AttemptSettingsDialogProps {
  open: boolean;
  contentId: string;
  classId: string;
  initial: { max_attempts?: number | null; attempt_interval_value?: number | null; attempt_interval_unit?: string | null };
  onClose: () => void;
  onSaved: () => void;
}

function AttemptSettingsDialog({
  open,
  contentId,
  classId,
  initial,
  onClose,
  onSaved,
}: AttemptSettingsDialogProps) {
  const [maxAttempts, setMaxAttempts] = useState(String(initial.max_attempts ?? ''));
  const [intervalValue, setIntervalValue] = useState(String(initial.attempt_interval_value ?? ''));
  const [intervalUnit, setIntervalUnit] = useState(initial.attempt_interval_unit ?? 'hours');

  const saveMutation = useMutation({
    mutationFn: () =>
      classesApi.updateContentItem(classId, contentId, {
        max_attempts: maxAttempts ? Number(maxAttempts) : null,
        attempt_interval_value: intervalValue ? Number(intervalValue) : null,
        attempt_interval_unit: intervalValue ? intervalUnit : null,
      }),
    onSuccess: () => { onSaved(); onClose(); },
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Assessment Attempt Settings</DialogTitle>
      <DialogContent sx={{ pt: '16px !important', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          label="Max Attempts"
          type="number"
          size="small"
          value={maxAttempts}
          onChange={(e) => setMaxAttempts(e.target.value)}
          placeholder="Unlimited"
          inputProps={{ min: 1 }}
          helperText="Leave blank for unlimited attempts"
        />
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            label="Interval"
            type="number"
            size="small"
            value={intervalValue}
            onChange={(e) => setIntervalValue(e.target.value)}
            placeholder="None"
            inputProps={{ min: 1 }}
            sx={{ flex: 1 }}
            helperText="Between retakes"
          />
          <FormControl size="small" sx={{ minWidth: 110 }}>
            <InputLabel>Unit</InputLabel>
            <Select
              value={intervalUnit}
              label="Unit"
              onChange={(e) => setIntervalUnit(e.target.value)}
            >
              <MenuItem value="minutes">Minutes</MenuItem>
              <MenuItem value="hours">Hours</MenuItem>
              <MenuItem value="days">Days</MenuItem>
              <MenuItem value="weeks">Weeks</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

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
  const [attemptSettingsFor, setAttemptSettingsFor] = useState<ClassContentDetail | null>(null);

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

  const resetAssessmentAttemptsMutation = useMutation({
    mutationFn: ({ contentId, studentId }: { contentId: string; studentId: string }) =>
      classesApi.resetAssessmentAttempts(id!, contentId, studentId),
    onSuccess: () => {
      invalidateContent();
      queryClient.invalidateQueries({ queryKey: ['classes', id, 'progress'] });
    },
  });

  // Content already in the class (to exclude from picker)
  const classContentIds = new Set(classContent.map((c: ClassContentDetail) => c.content_id));
  const availableToAdd = allContent.filter((c: Content) => !classContentIds.has(c.id));

  const isEnrolled = isStudent && (cls?.students ?? []).includes(user?.id ?? '');

  // Whether the org is "Nifty Academy" (no reset allowed)
  const isNiftyAcademy = cls?.org_name?.toLowerCase() === 'nifty academy';

  // Whether there are any test items in the class
  const hasAssessmentItems = classContent.some((c: ClassContentDetail) => c.type === 'assessment');

  // Auto-open next content after mark complete
  const handleMarkComplete = (currentContentId: string) => {
    markCompleteMutation.mutate(currentContentId, {
      onSuccess: () => {
        invalidateContent();
        const idx = classContent.findIndex(
          (x: ClassContentDetail) => x.content_id === currentContentId
        );
        const next: ClassContentDetail | undefined = classContent[idx + 1];
        if (next) {
          setViewContent(Object.assign({}, next, { accessible: true, completed: false }));
        } else {
          setViewContent(null);
        }
      },
    });
  };

  // Called from ContentViewDialog when test is passed (auto-mark complete handled server-side)
  const handleAssessmentPassed = () => {
    invalidateContent();
    if (!viewContent) return;
    const idx = classContent.findIndex(
      (x: ClassContentDetail) => x.content_id === viewContent.content_id
    );
    const next: ClassContentDetail | undefined = classContent[idx + 1];
    if (next) {
      setViewContent(Object.assign({}, next, { accessible: true, completed: false }));
    }
  };

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
                const isAssessmentItem = c.type === 'assessment';

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
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          {c.completed ? (
                            <Chip label="Done" size="small" color="success" sx={{ fontWeight: 700 }} />
                          ) : c.accessible ? (
                            <Chip label="In progress" size="small" color="warning" variant="outlined" sx={{ fontWeight: 700 }} />
                          ) : (
                            <Chip label="Locked" size="small" variant="outlined" sx={{ fontWeight: 700, color: 'text.disabled' }} />
                          )}
                          {isAssessmentItem && c.best_score != null && (
                            <Typography variant="caption" color="text.secondary">
                              Best: {c.best_score.toFixed(0)}%
                            </Typography>
                          )}
                          {isAssessmentItem && (c.attempts_count ?? 0) > 0 && (
                            <Typography variant="caption" color="text.secondary">
                              {c.attempts_count} attempt{c.attempts_count !== 1 ? 's' : ''}
                            </Typography>
                          )}
                        </Box>
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

                        {/* Test attempt settings (managers only) */}
                        {canManage && isAssessmentItem && (
                          <Button
                            size="small"
                            variant="text"
                            sx={{ borderRadius: 50, fontSize: '0.78rem' }}
                            onClick={() => setAttemptSettingsFor(c)}
                          >
                            Attempts
                          </Button>
                        )}

                        {/* Student: mark complete / unmark — NOT for tests */}
                        {isStudent && isEnrolled && c.accessible && !c.completed && !isAssessmentItem && (
                          <Button
                            size="small"
                            variant="contained"
                            color="success"
                            sx={{ borderRadius: 50, fontSize: '0.78rem' }}
                            onClick={() => handleMarkComplete(c.content_id)}
                            disabled={markCompleteMutation.isPending}
                          >
                            Mark Done
                          </Button>
                        )}
                        {isStudent && isEnrolled && c.completed && !isAssessmentItem && (
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

                        {/* Manager: reorder + remove */}
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
                            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
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
                              {hasAssessmentItems && !isNiftyAcademy && (
                                <Tooltip title="Reset all assessment attempts for this student">
                                  <span>
                                    <Button
                                      size="small"
                                      color="warning"
                                      variant="outlined"
                                      sx={{ borderRadius: 50, fontSize: '0.78rem' }}
                                      onClick={() => {
                                        const assessmentItems = classContent.filter(
                                          (c: ClassContentDetail) => c.type === 'assessment'
                                        );
                                        assessmentItems.forEach((c: ClassContentDetail) => {
                                          resetAssessmentAttemptsMutation.mutate({
                                            contentId: c.content_id,
                                            studentId: s.student_id,
                                          });
                                        });
                                      }}
                                      disabled={resetAssessmentAttemptsMutation.isPending}
                                    >
                                      Reset Assessments
                                    </Button>
                                  </span>
                                </Tooltip>
                              )}
                            </Box>
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

      {/* Test attempt settings dialog */}
      {attemptSettingsFor && (
        <AttemptSettingsDialog
          open={!!attemptSettingsFor}
          contentId={attemptSettingsFor.content_id}
          classId={id!}
          initial={{
            max_attempts: attemptSettingsFor.max_attempts,
            attempt_interval_value: attemptSettingsFor.attempt_interval_value,
            attempt_interval_unit: attemptSettingsFor.attempt_interval_unit,
          }}
          onClose={() => setAttemptSettingsFor(null)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['classes', id] });
            invalidateContent();
          }}
        />
      )}

      {/* Content viewer */}
      {viewContent && (
        <ContentViewDialog
          contentId={viewContent.content_id}
          classId={id}
          onClose={() => setViewContent(null)}
          canMarkDone={isStudent && isEnrolled && viewContent.accessible}
          completed={viewContent.completed}
          onMarkComplete={
            viewContent.type === 'assessment'
              ? handleAssessmentPassed
              : () => handleMarkComplete(viewContent.content_id)
          }
          onUnmark={() => {
            unmarkCompleteMutation.mutate(viewContent.content_id);
            setViewContent(Object.assign({}, viewContent, { completed: false }));
          }}
          markPending={markCompleteMutation.isPending || unmarkCompleteMutation.isPending}
          maxAttempts={viewContent.max_attempts}
          attemptsCount={viewContent.attempts_count}
          attemptIntervalValue={viewContent.attempt_interval_value}
          attemptIntervalUnit={viewContent.attempt_interval_unit}
        />
      )}
    </Box>
  );
}
