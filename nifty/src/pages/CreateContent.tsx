import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
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
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { contentApi } from '@/api/content';
import { useAuthStore } from '@/store/authStore';
import { ContentTypeOptions, ContentFileAccept, Role } from '@/constants';
import type { ContentType, ContentScope } from '@/types';

interface DraftQuestion {
  question: string;
  choices: string[];
  answer: number;
}

function QuestionBuilder({
  questions,
  onChange,
}: {
  questions: DraftQuestion[];
  onChange: (qs: DraftQuestion[]) => void;
}) {
  const [q, setQ] = useState('');
  const [choices, setChoices] = useState(['', '']);
  const [answer, setAnswer] = useState(0);
  const [err, setErr] = useState('');

  const addChoice = () => {
    if (choices.length < 6) setChoices(choices.concat(''));
  };

  const removeChoice = (i: number) => {
    if (choices.length <= 2) return;
    const next = choices.filter((_, idx) => idx !== i);
    setChoices(next);
    if (answer >= next.length) setAnswer(next.length - 1);
  };

  const addQuestion = () => {
    if (!q.trim()) { setErr('Question text is required'); return; }
    if (choices.some((c) => !c.trim())) { setErr('All choices must be filled in'); return; }
    setErr('');
    onChange(questions.concat([{ question: q.trim(), choices: choices.map((c) => c.trim()), answer }]));
    setQ('');
    setChoices(['', '']);
    setAnswer(0);
  };

  return (
    <Box>
      {questions.length > 0 && (
        <Box sx={{ mb: 2 }}>
          {questions.map((qItem, idx) => (
            <Box
              key={idx}
              sx={{
                p: 1.5,
                mb: 1,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1,
              }}
            >
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {idx + 1}. {qItem.question}
                </Typography>
                <Box sx={{ pl: 1 }}>
                  {qItem.choices.map((c, ci) => (
                    <Typography
                      key={ci}
                      variant="caption"
                      display="block"
                      sx={{ color: ci === qItem.answer ? 'success.main' : 'text.secondary' }}
                    >
                      {ci === qItem.answer ? '✓' : '○'} {c}
                    </Typography>
                  ))}
                </Box>
              </Box>
              <Tooltip title="Remove">
                <IconButton
                  size="small"
                  onClick={() => onChange(questions.filter((_, i) => i !== idx))}
                >
                  ✕
                </IconButton>
              </Tooltip>
            </Box>
          ))}
        </Box>
      )}

      <Box
        sx={{
          p: 2,
          border: '1px dashed',
          borderColor: 'divider',
          borderRadius: 2,
          bgcolor: 'action.hover',
        }}
      >
        <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', mb: 1 }}>
          Add Question
        </Typography>
        {err && (
          <Alert severity="error" sx={{ mb: 1, py: 0 }}>
            {err}
          </Alert>
        )}
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
        <RadioGroup
          value={String(answer)}
          onChange={(e) => setAnswer(Number(e.target.value))}
        >
          {choices.map((c, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
              <FormControlLabel
                value={String(i)}
                control={<Radio size="small" />}
                label=""
                sx={{ mr: 0 }}
              />
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
                <IconButton size="small" onClick={() => removeChoice(i)} sx={{ ml: 0.5 }}>
                  ✕
                </IconButton>
              )}
            </Box>
          ))}
        </RadioGroup>

        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
          {choices.length < 6 && (
            <Button size="small" variant="outlined" onClick={addChoice} sx={{ borderRadius: 2 }}>
              + Choice
            </Button>
          )}
          <Button
            size="small"
            variant="contained"
            onClick={addQuestion}
            sx={{ borderRadius: 2, ml: 'auto' }}
          >
            Add Question
          </Button>
        </Box>
      </Box>
    </Box>
  );
}

export default function CreateContent() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canGlobal = Role.global_scope.includes(user?.role as never);

  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [type, setType] = useState<ContentType>('text');
  const [scope, setScope] = useState<ContentScope>('org');
  const [body, setBody] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');

  // Test-specific state
  const [passingScore, setPassingScore] = useState<number>(70);
  const [maxQuestions, setMaxQuestions] = useState<string>('');
  const [draftQuestions, setDraftQuestions] = useState<DraftQuestion[]>([]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = { title, subject, type, scope, body };
      if (type === 'assessment') {
        payload.passing_score = passingScore;
        if (maxQuestions) payload.max_questions = Number(maxQuestions);
      }
      const created = await contentApi.create(payload as Parameters<typeof contentApi.create>[0]);
      if (file) {
        await contentApi.uploadFile(created.id, file);
      }
      if (type === 'assessment' && draftQuestions.length > 0) {
        await contentApi.addQuestions(created.id, draftQuestions);
      }
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content'] });
      navigate('/app/my-content');
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Failed to create content';
      setError(msg);
    },
  });

  const needsFile = type === 'video' || type === 'audio' || type === 'pdf';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!title || !subject) {
      setError('Title and subject are required');
      return;
    }
    if (needsFile && !file) {
      setError(`A ${type} file is required for this content type`);
      return;
    }
    createMutation.mutate();
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 0.5 }}>
        ✏️ Create Content
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Add new learning material{canGlobal ? ' for all subscribers or your organization' : ' for your organization'}
      </Typography>

      <Card sx={{ maxWidth: 680 }}>
        <CardContent sx={{ p: 3.5 }}>
          <Typography variant="h5" sx={{ mb: 3 }}>
            New Content
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              label="Content Title"
              fullWidth
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Introduction to Scratch Programming"
              sx={{ mb: 2.5 }}
              required
            />

            <TextField
              label="Subject / Topic"
              fullWidth
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Programming, AI, Robotics"
              sx={{ mb: 2.5 }}
              required
            />

            {/* Content type selector */}
            <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', mb: 1 }}>
              Content Type
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2.5 }}>
              {ContentTypeOptions.map((opt) => (
                <Box
                  key={opt.value}
                  onClick={() => { setType(opt.value); setFile(null); }}
                  sx={{
                    flex: '1 1 80px',
                    p: 2,
                    border: '2px solid',
                    borderColor: type === opt.value ? 'primary.main' : 'divider',
                    borderRadius: 2,
                    cursor: 'pointer',
                    textAlign: 'center',
                    background: type === opt.value ? '#FFEDD5' : 'transparent',
                    transition: 'all .2s',
                    '&:hover': { borderColor: 'primary.main' },
                  }}
                >
                  <Typography sx={{ fontSize: '1.8rem', mb: 0.5 }}>{opt.icon}</Typography>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.85rem' }}>{opt.label}</Typography>
                </Box>
              ))}
            </Box>

            {/* Scope selector (only for super_admin / tutor) */}
            {canGlobal && (
              <FormControl fullWidth sx={{ mb: 2.5 }}>
                <InputLabel>Access Scope</InputLabel>
                <Select
                  value={scope}
                  label="Access Scope"
                  onChange={(e) => setScope(e.target.value as ContentScope)}
                >
                  <MenuItem value="global">🌍 Global — visible to all subscribers</MenuItem>
                  <MenuItem value="org">🏫 Organization only</MenuItem>
                </Select>
              </FormControl>
            )}

            {type === 'text' && (
              <TextField
                label="Content Body"
                fullWidth
                multiline
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your lesson content here..."
                sx={{ mb: 2.5 }}
              />
            )}

            {/* File upload — shown for video / audio / pdf */}
            {needsFile && (
              <Box sx={{ mb: 3 }}>
                <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', mb: 1 }}>
                  Upload {type.toUpperCase()} File <span style={{ color: '#EF4444' }}>*</span>
                </Typography>
                <Button
                  variant="outlined"
                  component="label"
                  size="small"
                  sx={{ borderRadius: 2 }}
                >
                  {file ? `📎 ${file.name}` : `Choose ${type.toUpperCase()} file`}
                  <input
                    type="file"
                    hidden
                    accept={ContentFileAccept[type]}
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </Button>
              </Box>
            )}

            {/* Test settings */}
            {type === 'assessment' && (
              <>
                <Box sx={{ display: 'flex', gap: 2, mb: 2.5 }}>
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
                    label="Max Questions per Attempt"
                    type="number"
                    size="small"
                    value={maxQuestions}
                    onChange={(e) => setMaxQuestions(e.target.value)}
                    placeholder="All"
                    inputProps={{ min: 1 }}
                    sx={{ width: 210 }}
                    helperText="Leave blank to use all questions"
                  />
                </Box>

                <Divider sx={{ mb: 2 }} />
                <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 1.5 }}>
                  Question Bank ({draftQuestions.length} questions)
                </Typography>
                <QuestionBuilder
                  questions={draftQuestions}
                  onChange={setDraftQuestions}
                />
                <Box sx={{ mb: 2.5 }} />
              </>
            )}

            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={createMutation.isPending}
              startIcon={
                createMutation.isPending ? (
                  <CircularProgress size={16} color="inherit" />
                ) : null
              }
            >
              Publish Content 🚀
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
