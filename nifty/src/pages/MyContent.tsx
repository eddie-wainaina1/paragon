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
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contentApi } from '@/api/content';
import { useAuthStore } from '@/store/authStore';
import { ContentTypeStyle, Role } from '@/constants';
import type { Content, ContentType, ContentScope } from '@/types';

interface EditDialogProps {
  content: Content | null;
  canGlobal: boolean;
  onClose: () => void;
  onSaved: () => void;
}

function EditDialog({ content, canGlobal, onClose, onSaved }: EditDialogProps) {
  const [title, setTitle] = useState(content?.title ?? '');
  const [subject, setSubject] = useState(content?.subject ?? '');
  const [body, setBody] = useState(content?.body ?? '');
  const [type, setType] = useState<ContentType>((content?.type as ContentType) ?? 'text');
  const [scope, setScope] = useState<ContentScope>((content?.scope as ContentScope) ?? 'org');
  const [error, setError] = useState('');

  const updateMutation = useMutation({
    mutationFn: () =>
      contentApi.update(content!.id, { title, subject, body, type, scope }),
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
              <MenuItem value="text">📝 Text</MenuItem>
              <MenuItem value="video">🎬 Video</MenuItem>
              <MenuItem value="audio">🎧 Audio</MenuItem>
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
          <TextField
            label="Body"
            fullWidth
            multiline
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
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
                const tc = ContentTypeStyle.chip[c.type] ?? ContentTypeStyle.chip.text;
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Typography fontWeight={700} fontSize="0.9rem">
                        {c.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {c.subject}
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
