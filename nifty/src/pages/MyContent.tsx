import { useState } from 'react';
import {
  Box,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
  Button,
  Paper,
  Skeleton,
  Dialog,
  DialogContent,
  DialogTitle,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
  Divider,
  IconButton,
  Radio,
  RadioGroup,
  FormControlLabel,
  Tooltip,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contentApi } from '@/api/content';
import { useAuthStore } from '@/store/authStore';
import { ContentTypeStyle, Role } from '@/constants';
import type { Content, ContentType, ContentScope, AssessmentQuestion } from '@/types';

// ── Inline question builder (add only) ───────────────────────────────────────

interface DraftQuestion {
  question: string;
  choices: string[];
  answer: number;
}

function AddQuestionForm({ onAdd }: { onAdd: (q: DraftQuestion) => void }) {
  const [q, setQ] = useState('');
  const [choices, setChoices] = useState(['', '']);
  const [answer, setAnswer] = useState(0);
  const [err, setErr] = useState('');

  const submit = () => {
    if (!q.trim()) { setErr('Question text is required'); return; }
    if (choices.some((c) => !c.trim())) { setErr('All choices must be filled in'); return; }
    setErr('');
    onAdd({ question: q.trim(), choices: choices.map((c) => c.trim()), answer });
    setQ('');
    setChoices(['', '']);
    setAnswer(0);
  };

  return (
    <Box sx={{ p: 2, border: '1px dashed', borderColor: 'divider', borderRadius: 2, bgcolor: 'action.hover' }}>
      <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', mb: 1 }}>Add Question</Typography>
      {err && <Alert severity="error" sx={{ mb: 1, py: 0 }}>{err}</Alert>}
      <TextField
        label="Question"
        fullWidth
        size="small"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        sx={{ mb: 1.5 }}
      />
      <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, mb: 0.5 }}>
        Choices (select the correct answer)
      </Typography>
      <RadioGroup value={String(answer)} onChange={(e) => setAnswer(Number(e.target.value))}>
        {choices.map((c, i) => (
          <Box key={i} sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
            <FormControlLabel value={String(i)} control={<Radio size="small" />} label="" sx={{ mr: 0 }} />
            <TextField
              size="small"
              value={c}
              onChange={(e) => {
                const next = choices.slice();
                next[i] = e.target.value;
                setChoices(next);
              }}
              placeholder={`Choice ${i + 1}`}
              sx={{ flex: 1 }}
            />
            {choices.length > 2 && (
              <IconButton size="small" onClick={() => {
                const next = choices.filter((_, idx) => idx !== i);
                setChoices(next);
                if (answer >= next.length) setAnswer(next.length - 1);
              }} sx={{ ml: 0.5 }}>✕</IconButton>
            )}
          </Box>
        ))}
      </RadioGroup>
      <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
        {choices.length < 6 && (
          <Button size="small" variant="outlined" onClick={() => setChoices(choices.concat(''))} sx={{ borderRadius: 2 }}>
            + Choice
          </Button>
        )}
        <Button size="small" variant="contained" onClick={submit} sx={{ borderRadius: 2, ml: 'auto' }}>
          Add Question
        </Button>
      </Box>
    </Box>
  );
}

// ── Edit dialog ───────────────────────────────────────────────────────────────

interface EditDialogProps {
  content: Content | null;
  canGlobal: boolean;
  onClose: () => void;
  onSaved: () => void;
}

function EditDialog({ content, canGlobal, onClose, onSaved }: EditDialogProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(content?.title ?? '');
  const [subject, setSubject] = useState(content?.subject ?? '');
  const [body, setBody] = useState(content?.body ?? '');
  const [type, setType] = useState<ContentType>((content?.type as ContentType) ?? 'text');
  const [scope, setScope] = useState<ContentScope>((content?.scope as ContentScope) ?? 'org');
  const [passingScore, setPassingScore] = useState(content?.passing_score ?? 70);
  const [maxQuestions, setMaxQuestions] = useState(String(content?.max_questions ?? ''));
  const [error, setError] = useState('');

  // Fetch questions for test type
  const { data: existingQuestions = [], refetch: refetchQuestions } = useQuery({
    queryKey: ['content', content?.id, 'questions'],
    queryFn: () => contentApi.getQuestions(content!.id),
    enabled: !!content && content.type === 'assessment',
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = { title, subject, body, type, scope };
      if (type === 'assessment') {
        payload.passing_score = passingScore;
        payload.max_questions = maxQuestions ? Number(maxQuestions) : null;
      }
      return contentApi.update(content!.id, payload as Parameters<typeof contentApi.update>[1]);
    },
    onSuccess: () => {
      onSaved();
      onClose();
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Failed to save changes';
      setError(msg);
    },
  });

  const addQuestionMutation = useMutation({
    mutationFn: (q: Omit<AssessmentQuestion, 'qid'>) =>
      contentApi.addQuestions(content!.id, [q]),
    onSuccess: () => {
      refetchQuestions();
      queryClient.invalidateQueries({ queryKey: ['content'] });
    },
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: (qid: string) => contentApi.deleteQuestion(content!.id, qid),
    onSuccess: () => {
      refetchQuestions();
      queryClient.invalidateQueries({ queryKey: ['content'] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) { setError('Title is required'); return; }
    setError('');
    updateMutation.mutate();
  };

  return (
    <Dialog
      open={!!content}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 4, border: '2px solid', borderColor: 'divider' } }}
    >
      <DialogTitle sx={{ fontFamily: "'Fredoka One', cursive" }}>✏️ Edit Content</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
            {error}
          </Alert>
        )}
        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="Title"
            fullWidth
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <TextField
            label="Subject / Topic"
            fullWidth
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
          <FormControl fullWidth>
            <InputLabel>Type</InputLabel>
            <Select value={type} label="Type" onChange={(e) => setType(e.target.value as ContentType)}>
              <MenuItem value="text">📄 Text</MenuItem>
              <MenuItem value="video">🎬 Video</MenuItem>
              <MenuItem value="audio">🎧 Audio</MenuItem>
              <MenuItem value="pdf">📑 PDF</MenuItem>
              <MenuItem value="assessment">📝 Assessment</MenuItem>
            </Select>
          </FormControl>
          {canGlobal && (
            <FormControl fullWidth>
              <InputLabel>Scope</InputLabel>
              <Select value={scope} label="Scope" onChange={(e) => setScope(e.target.value as ContentScope)}>
                <MenuItem value="global">🌍 Global</MenuItem>
                <MenuItem value="org">🏫 Org</MenuItem>
              </Select>
            </FormControl>
          )}
          {type === 'text' && (
            <TextField
              label="Body"
              fullWidth
              multiline
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          )}

          {/* Test-specific settings */}
          {type === 'assessment' && (
            <>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="Passing Score (%)"
                  type="number"
                  size="small"
                  value={passingScore}
                  onChange={(e) => setPassingScore(Number(e.target.value))}
                  inputProps={{ min: 0, max: 100 }}
                  sx={{ width: 160 }}
                />
                <TextField
                  label="Max Questions / Attempt"
                  type="number"
                  size="small"
                  value={maxQuestions}
                  onChange={(e) => setMaxQuestions(e.target.value)}
                  placeholder="All"
                  inputProps={{ min: 1 }}
                  sx={{ flex: 1 }}
                />
              </Box>

              <Divider />
              <Typography sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
                Question Bank ({existingQuestions.length} questions)
              </Typography>

              {existingQuestions.map((q: AssessmentQuestion) => (
                <Box
                  key={q.qid}
                  sx={{
                    p: 1.5,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 1,
                  }}
                >
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{q.question}</Typography>
                    <Box sx={{ pl: 1 }}>
                      {q.choices.map((c, ci) => (
                        <Typography
                          key={ci}
                          variant="caption"
                          display="block"
                          sx={{ color: ci === q.answer ? 'success.main' : 'text.secondary' }}
                        >
                          {ci === q.answer ? '✓' : '○'} {c}
                        </Typography>
                      ))}
                    </Box>
                  </Box>
                  <Tooltip title="Delete question">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => deleteQuestionMutation.mutate(q.qid)}
                      disabled={deleteQuestionMutation.isPending}
                    >
                      ✕
                    </IconButton>
                  </Tooltip>
                </Box>
              ))}

              <AddQuestionForm
                onAdd={(q) => addQuestionMutation.mutate(q)}
              />
            </>
          )}

          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button
              type="submit"
              variant="contained"
              disabled={updateMutation.isPending}
              startIcon={updateMutation.isPending ? <CircularProgress size={16} color="inherit" /> : null}
            >
              Save Changes
            </Button>
            <Button variant="outlined" onClick={onClose}>
              Cancel
            </Button>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

export default function MyContent() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [editingContent, setEditingContent] = useState<Content | null>(null);
  const canGlobal = Role.global_scope.includes(user?.role as never);

  const { data: all = [], isLoading } = useQuery({
    queryKey: ['content'],
    queryFn: () => contentApi.list(),
  });

  const mine: Content[] =
    user?.role === 'super_admin' ? all : all.filter((c) => c.author === user?.id);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => contentApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['content'] }),
  });

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 0.5 }}>
        🗂️ My Content
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {mine.length} item{mine.length !== 1 ? 's' : ''} you've created
      </Typography>

      <Paper
        variant="outlined"
        sx={{ borderRadius: 3, border: '2px solid', borderColor: 'divider', overflow: 'hidden' }}
      >
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Title</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Scope</TableCell>
              <TableCell>Views</TableCell>
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
            ) : mine.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                    <Typography sx={{ fontSize: '3rem', mb: 1 }}>📭</Typography>
                    <Typography>No content yet. Create your first lesson!</Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              mine.map((c) => {
                const tc = (ContentTypeStyle.chip as Record<string, { bg: string; color: string }>)[c.type]
                  ?? ContentTypeStyle.chip.text;
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Typography fontWeight={700} fontSize="0.9rem">
                        {c.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {c.subject}
                        {c.type === 'assessment' && c.questions_count !== undefined && (
                          <> · {c.questions_count} questions</>
                        )}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={c.type}
                        size="small"
                        sx={{ background: tc.bg, color: tc.color, fontWeight: 700 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={c.scope === 'global' ? '🌍 Global' : '🏫 Org'}
                        size="small"
                        sx={{
                          background: c.scope === 'global' ? '#FEF3C7' : '#EDE9FE',
                          color: c.scope === 'global' ? '#92400E' : '#5B21B6',
                          fontWeight: 700,
                        }}
                      />
                    </TableCell>
                    <TableCell>👁 {c.views}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                          size="small"
                          variant="contained"
                          sx={{ borderRadius: 50, fontSize: '0.78rem', py: 0.5 }}
                          onClick={() => setEditingContent(c)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          variant="contained"
                          sx={{ borderRadius: 50, fontSize: '0.78rem', py: 0.5 }}
                          onClick={() => deleteMutation.mutate(c.id)}
                          disabled={deleteMutation.isPending}
                        >
                          Delete
                        </Button>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Paper>

      <EditDialog
        content={editingContent}
        canGlobal={canGlobal}
        onClose={() => setEditingContent(null)}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['content'] })}
      />
    </Box>
  );
}
