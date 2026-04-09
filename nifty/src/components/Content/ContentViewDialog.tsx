import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Chip,
  IconButton,
  Divider,
  CircularProgress,
  Button,
  Radio,
  RadioGroup,
  FormControlLabel,
  LinearProgress,
  Alert,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import Hls from 'hls.js';
import { useQuery, useMutation } from '@tanstack/react-query';
import { contentApi } from '@/api/content';
import { classesApi } from '@/api/classes';
import HlsVideoPlayer from './HlsVideoPlayer';
import HlsAudioPlayer from './HlsAudioPlayer';
import PdfViewer from './PdfViewer';
import type { AssessmentQuestionForStudent, AssessmentAttemptResult } from '@/types';

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1';

const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  text:  { bg: '#DBEAFE', color: '#1D4ED8' },
  video: { bg: '#FCE7F3', color: '#BE185D' },
  audio: { bg: '#D1FAE5', color: '#065F46' },
  pdf:   { bg: '#FEF3C7', color: '#92400E' },
  test:  { bg: '#EDE9FE', color: '#5B21B6' },
};

const THUMB_GRADIENTS: Record<string, string> = {
  text:  'linear-gradient(135deg,#DBEAFE,#EFF6FF)',
  video: 'linear-gradient(135deg,#FCE7F3,#FDF2F8)',
  audio: 'linear-gradient(135deg,#D1FAE5,#ECFDF5)',
  pdf:   'linear-gradient(135deg,#FEF3C7,#FFFBEB)',
  test:  'linear-gradient(135deg,#EDE9FE,#F5F3FF)',
};

type AssessmentState = 'idle' | 'taking' | 'result';

interface Props {
  contentId: string | null;
  onClose: () => void;
  // Optional mark-done context (ClassDetail student view only)
  canMarkDone?: boolean;
  completed?: boolean;
  onMarkComplete?: () => void;
  onUnmark?: () => void;
  markPending?: boolean;
  // Required for test interactions
  classId?: string;
  // Extra class-content metadata passed through from ClassDetail
  maxAttempts?: number | null;
  attemptsCount?: number;
  attemptIntervalValue?: number | null;
  attemptIntervalUnit?: string | null;
}

export default function ContentViewDialog({
  contentId,
  onClose,
  canMarkDone,
  completed,
  onMarkComplete,
  onUnmark,
  markPending,
  classId,
  maxAttempts,
  attemptsCount = 0,
  attemptIntervalValue,
  attemptIntervalUnit,
}: Props) {
  const open = !!contentId;

  // Test state machine
  const [assessmentState, setAssessmentState] = useState<AssessmentState>('idle');
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [assessmentQuestions, setAssessmentQuestions] = useState<AssessmentQuestionForStudent[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [assessmentResult, setAssessmentResult] = useState<AssessmentAttemptResult | null>(null);
  const [assessmentError, setAssessmentError] = useState('');

  // GET /content/{id} increments the view counter on the backend
  const { data: content, isLoading } = useQuery({
    queryKey: ['content', contentId],
    queryFn: () => contentApi.get(contentId!),
    enabled: open,
  });

  // File token only needed for PDF (audio and video both use HLS)
  const needsFileToken = open && !!content?.file_id && content.type === 'pdf';
  const { data: fileToken, isLoading: isTokenLoading } = useQuery({
    queryKey: ['content-file-token', contentId],
    queryFn: () => contentApi.getFileToken(contentId!),
    enabled: needsFileToken,
    staleTime: 25 * 60 * 1000,
  });

  // Stream URL used only by audio and PDF
  const streamUrl = content?.file_id && fileToken
    ? `${BASE_URL}/content/${content.id}/file?token=${encodeURIComponent(fileToken)}`
    : null;

  const isVideo = content?.type === 'video';
  const isAudio = content?.type === 'audio';
  const isPdf = content?.type === 'pdf';
  const isAssessment = content?.type === 'assessment';
  const typeColor = content ? (TYPE_COLORS[content.type] ?? TYPE_COLORS.text) : TYPE_COLORS.text;

  const startAssessmentMutation = useMutation({
    mutationFn: () => classesApi.startAssessment(classId!, contentId!),
    onSuccess: (data) => {
      setAttemptId(data.attempt_id);
      setAssessmentQuestions(data.questions);
      setAnswers({});
      setAssessmentState('taking');
      setAssessmentError('');
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Failed to start test';
      setAssessmentError(msg);
    },
  });

  const submitAssessmentMutation = useMutation({
    mutationFn: () =>
      classesApi.submitAssessment(classId!, contentId!, attemptId!, answers),
    onSuccess: (result) => {
      setAssessmentResult(result);
      setAssessmentState('result');
      if (result.passed && onMarkComplete) {
        onMarkComplete();
      }
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Failed to submit test';
      setAssessmentError(msg);
    },
  });

  const handleClose = () => {
    setAssessmentState('idle');
    setAttemptId(null);
    setAssessmentQuestions([]);
    setAnswers({});
    setAssessmentResult(null);
    setAssessmentError('');
    onClose();
  };

  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === assessmentQuestions.length && assessmentQuestions.length > 0;

  // Check if student can attempt (max attempts check client-side for UX, server also validates)
  const attemptsExhausted = maxAttempts != null && attemptsCount >= maxAttempts;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth={isVideo || isPdf ? 'md' : 'sm'}
      fullWidth
      PaperProps={{ sx: { borderRadius: 4, border: '2px solid', borderColor: 'divider' } }}
    >
      <DialogContent sx={{ p: 0 }}>

        {/* ── Video: full-width dark player at top ── */}
        {isVideo && (
          <Box
            sx={{
              background: '#0d0d0d',
              position: 'relative',
              borderRadius: '16px 16px 0 0',
              overflow: 'hidden',
              minHeight: 240,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isLoading ? (
              <CircularProgress sx={{ color: 'rgba(255,255,255,0.6)' }} />
            ) : content?.hls_ready && Hls.isSupported() ? (
              <HlsVideoPlayer contentId={content.id} />
            ) : content?.file_id && !content.hls_ready ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <CircularProgress size={32} sx={{ color: 'rgba(255,255,255,0.6)', mb: 1.5, display: 'block', mx: 'auto' }} />
                <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>
                  Video is being processed. Check back shortly.
                </Typography>
              </Box>
            ) : (
              <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.9rem' }}>
                No video attached
              </Typography>
            )}

            <IconButton
              onClick={handleClose}
              size="small"
              sx={{
                position: 'absolute',
                top: 10,
                right: 10,
                background: 'rgba(0,0,0,0.55)',
                color: '#fff',
                '&:hover': { background: 'rgba(0,0,0,0.75)' },
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        )}

        {/* ── Text / Audio / PDF / Test: emoji thumbnail header ── */}
        {!isVideo && (
          <Box
            sx={{
              height: 140,
              background: content ? (THUMB_GRADIENTS[content.type] ?? '#F8FAFC') : '#F8FAFC',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {isLoading ? (
              <CircularProgress />
            ) : (
              <Typography sx={{ fontSize: '3.5rem' }}>{content?.emoji}</Typography>
            )}

            {content && (
              <>
                <Chip
                  label={content.type}
                  size="small"
                  sx={{
                    position: 'absolute',
                    top: 12,
                    left: 12,
                    background: typeColor.bg,
                    color: typeColor.color,
                    fontWeight: 800,
                    fontSize: '0.68rem',
                    textTransform: 'uppercase',
                  }}
                />
                <Chip
                  label={content.scope === 'global' ? 'Global' : 'Org'}
                  size="small"
                  sx={{
                    position: 'absolute',
                    top: 12,
                    right: 48,
                    background: content.scope === 'global' ? '#FEF3C7' : '#EDE9FE',
                    color: content.scope === 'global' ? '#92400E' : '#5B21B6',
                    fontWeight: 800,
                    fontSize: '0.68rem',
                  }}
                />
              </>
            )}

            <IconButton
              onClick={handleClose}
              size="small"
              sx={{ position: 'absolute', top: 8, right: 8, background: 'rgba(255,255,255,0.8)' }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        )}

        {/* ── Body ── */}
        <Box sx={{ p: 3 }}>
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : content ? (
            <>
              {/* For video: type + scope chips inline since no thumbnail header */}
              {isVideo && (
                <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
                  <Chip
                    label={content.type}
                    size="small"
                    sx={{
                      background: typeColor.bg,
                      color: typeColor.color,
                      fontWeight: 800,
                      fontSize: '0.68rem',
                      textTransform: 'uppercase',
                    }}
                  />
                  <Chip
                    label={content.scope === 'global' ? 'Global' : 'Org'}
                    size="small"
                    sx={{
                      background: content.scope === 'global' ? '#FEF3C7' : '#EDE9FE',
                      color: content.scope === 'global' ? '#92400E' : '#5B21B6',
                      fontWeight: 800,
                      fontSize: '0.68rem',
                    }}
                  />
                </Box>
              )}

              <Typography variant="h5" sx={{ mb: 0.5, lineHeight: 1.3 }}>
                {content.title}
              </Typography>

              <Box
                sx={{
                  display: 'flex',
                  gap: 1.5,
                  flexWrap: 'wrap',
                  mb: 2,
                  color: 'text.secondary',
                  fontSize: '0.82rem',
                }}
              >
                {content.subject && <span>{content.subject}</span>}
                <span>{content.views} views</span>
                {content.author_name && <span>{content.author_name}</span>}
                {content.org_name && <span>{content.org_name}</span>}
              </Box>

              <Divider sx={{ mb: 2 }} />

              {/* ── PDF viewer ── */}
              {isPdf && (
                <Box sx={{ mb: 2 }}>
                  {isTokenLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                      <CircularProgress size={28} />
                    </Box>
                  ) : streamUrl ? (
                    <PdfViewer url={streamUrl} />
                  ) : (
                    <Typography color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      No PDF attached.
                    </Typography>
                  )}
                </Box>
              )}

              {/* ── Audio player ── */}
              {isAudio && (
                <Box sx={{ mb: content.body ? 2.5 : 0 }}>
                  {content.hls_ready && Hls.isSupported() ? (
                    <HlsAudioPlayer contentId={content.id} />
                  ) : content.file_id && !content.hls_ready ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1 }}>
                      <CircularProgress size={20} />
                      <Typography color="text.secondary" sx={{ fontSize: '0.9rem' }}>
                        Audio is being processed. Check back shortly.
                      </Typography>
                    </Box>
                  ) : (
                    <Typography color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      No audio attached.
                    </Typography>
                  )}
                </Box>
              )}

              {/* ── Text body ── */}
              {content.body && (
                <Box
                  sx={{
                    maxHeight: 400,
                    overflowY: 'auto',
                    pr: 0.5,
                    '&::-webkit-scrollbar': { width: 6 },
                    '&::-webkit-scrollbar-track': { background: 'transparent' },
                    '&::-webkit-scrollbar-thumb': {
                      background: 'rgba(0,0,0,0.15)',
                      borderRadius: 3,
                    },
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: '0.95rem',
                      lineHeight: 1.8,
                      whiteSpace: 'pre-wrap',
                      color: 'text.primary',
                    }}
                  >
                    {content.body}
                  </Typography>
                </Box>
              )}

              {/* Empty state */}
              {!content.body && !content.file_id && !isAssessment && (
                <Typography color="text.secondary" sx={{ fontStyle: 'italic' }}>
                  No content body attached.
                </Typography>
              )}

              {/* ── Test UI ── */}
              {isAssessment && (
                <>
                  {assessmentError && (
                    <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                      {assessmentError}
                    </Alert>
                  )}

                  {assessmentState === 'idle' && (
                    <Box>
                      <Box
                        sx={{
                          p: 2,
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 2,
                          mb: 2,
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 2,
                        }}
                      >
                        <Box>
                          <Typography variant="caption" color="text.secondary">Questions</Typography>
                          <Typography fontWeight={700}>{content.questions_count ?? 0}</Typography>
                        </Box>
                        {content.max_questions && (
                          <Box>
                            <Typography variant="caption" color="text.secondary">Per attempt</Typography>
                            <Typography fontWeight={700}>{content.max_questions}</Typography>
                          </Box>
                        )}
                        <Box>
                          <Typography variant="caption" color="text.secondary">Passing score</Typography>
                          <Typography fontWeight={700}>{content.passing_score ?? 70}%</Typography>
                        </Box>
                        {maxAttempts != null && (
                          <Box>
                            <Typography variant="caption" color="text.secondary">Attempts</Typography>
                            <Typography fontWeight={700}>{attemptsCount}/{maxAttempts}</Typography>
                          </Box>
                        )}
                        {attemptIntervalValue && attemptIntervalUnit && (
                          <Box>
                            <Typography variant="caption" color="text.secondary">Interval</Typography>
                            <Typography fontWeight={700}>
                              {attemptIntervalValue} {attemptIntervalUnit}
                            </Typography>
                          </Box>
                        )}
                      </Box>

                      {canMarkDone && (
                        attemptsExhausted ? (
                          <Alert severity="warning" sx={{ borderRadius: 2 }}>
                            You have used all {maxAttempts} attempt{maxAttempts !== 1 ? 's' : ''} for this assessment.
                          </Alert>
                        ) : completed ? (
                          <Alert severity="success" sx={{ borderRadius: 2 }}>
                            You passed this assessment! You can retake it if attempts remain.
                          </Alert>
                        ) : null
                      )}
                    </Box>
                  )}

                  {assessmentState === 'taking' && (
                    <Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                        <Typography variant="body2" color="text.secondary">
                          {answeredCount} of {assessmentQuestions.length} answered
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={(answeredCount / assessmentQuestions.length) * 100}
                        sx={{ mb: 2.5, borderRadius: 1 }}
                      />
                      {assessmentQuestions.map((q, qi) => (
                        <Box key={q.qid} sx={{ mb: 3 }}>
                          <Typography sx={{ fontWeight: 600, mb: 1 }}>
                            {qi + 1}. {q.question}
                          </Typography>
                          <RadioGroup
                            value={answers[q.qid] !== undefined ? String(answers[q.qid]) : ''}
                            onChange={(e) => {
                              const updated = Object.assign({}, answers);
                              updated[q.qid] = Number(e.target.value);
                              setAnswers(updated);
                            }}
                          >
                            {q.choices.map((choice, ci) => (
                              <FormControlLabel
                                key={ci}
                                value={String(ci)}
                                control={<Radio size="small" />}
                                label={choice}
                                sx={{
                                  ml: 0,
                                  mb: 0.5,
                                  px: 1,
                                  borderRadius: 1,
                                  border: '1px solid',
                                  borderColor:
                                    answers[q.qid] === ci ? 'primary.main' : 'divider',
                                  background:
                                    answers[q.qid] === ci ? 'rgba(249,115,22,0.06)' : 'transparent',
                                }}
                              />
                            ))}
                          </RadioGroup>
                        </Box>
                      ))}
                    </Box>
                  )}

                  {assessmentState === 'result' && assessmentResult && (
                    <Box sx={{ textAlign: 'center', py: 2 }}>
                      <Typography variant="h4" sx={{ mb: 0.5, fontWeight: 800 }}>
                        {assessmentResult.score.toFixed(0)}%
                      </Typography>
                      <Chip
                        label={assessmentResult.passed ? 'Passed' : 'Failed'}
                        color={assessmentResult.passed ? 'success' : 'error'}
                        sx={{ fontWeight: 700, mb: 2 }}
                      />
                      <Typography color="text.secondary" sx={{ mb: 0.5 }}>
                        {assessmentResult.correct} of {assessmentResult.total} correct
                      </Typography>
                      {assessmentResult.attempts_remaining !== null && (
                        <Typography variant="caption" color="text.secondary">
                          {assessmentResult.attempts_remaining} attempt{assessmentResult.attempts_remaining !== 1 ? 's' : ''} remaining
                        </Typography>
                      )}
                    </Box>
                  )}
                </>
              )}
            </>
          ) : null}
        </Box>
      </DialogContent>

      {/* ── Footer actions ── */}
      {isAssessment && canMarkDone && assessmentState !== 'taking' && (
        <DialogActions sx={{ px: 3, pb: 2.5, pt: 0, justifyContent: 'space-between' }}>
          <Box />
          {assessmentState === 'idle' && !attemptsExhausted && (
            <Button
              variant="contained"
              onClick={() => startAssessmentMutation.mutate()}
              disabled={startAssessmentMutation.isPending}
              startIcon={startAssessmentMutation.isPending ? <CircularProgress size={14} color="inherit" /> : null}
              sx={{ borderRadius: 50 }}
            >
              {attemptsCount > 0 ? 'Retake Assessment' : 'Start Assessment'}
            </Button>
          )}
          {assessmentState === 'result' && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              {assessmentResult && !assessmentResult.passed &&
                (assessmentResult.attempts_remaining == null || assessmentResult.attempts_remaining > 0) && (
                <Button
                  variant="contained"
                  onClick={() => startAssessmentMutation.mutate()}
                  disabled={startAssessmentMutation.isPending}
                  sx={{ borderRadius: 50 }}
                >
                  Try Again
                </Button>
              )}
              <Button variant="outlined" onClick={handleClose} sx={{ borderRadius: 50 }}>
                Close
              </Button>
            </Box>
          )}
        </DialogActions>
      )}

      {isAssessment && canMarkDone && assessmentState === 'taking' && (
        <DialogActions sx={{ px: 3, pb: 2.5, pt: 0, justifyContent: 'space-between' }}>
          <Button
            variant="outlined"
            color="inherit"
            onClick={() => setAssessmentState('idle')}
            sx={{ borderRadius: 50 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={() => submitAssessmentMutation.mutate()}
            disabled={!allAnswered || submitAssessmentMutation.isPending}
            startIcon={submitAssessmentMutation.isPending ? <CircularProgress size={14} color="inherit" /> : null}
            sx={{ borderRadius: 50 }}
          >
            Submit ({answeredCount}/{assessmentQuestions.length})
          </Button>
        </DialogActions>
      )}

      {!isAssessment && canMarkDone && (
        <DialogActions sx={{ px: 3, pb: 2.5, pt: 0 }}>
          {completed ? (
            <Button
              variant="outlined"
              color="inherit"
              sx={{ borderRadius: 50 }}
              onClick={onUnmark}
              disabled={markPending}
            >
              Mark as Not Done
            </Button>
          ) : (
            <Button
              variant="contained"
              color="success"
              sx={{ borderRadius: 50 }}
              onClick={onMarkComplete}
              disabled={markPending}
            >
              Mark as Done ✓
            </Button>
          )}
        </DialogActions>
      )}
    </Dialog>
  );
}
