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
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { contentApi } from '@/api/content';
import { useAuthStore } from '@/store/authStore';
import { ContentTypeOptions, Role } from '@/constants';
import type { ContentType, ContentScope } from '@/types';

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

  const createMutation = useMutation({
    mutationFn: () =>
      contentApi.create({ title, subject, type, scope, body }),
    onSuccess: async (created) => {
      if (file) {
        await contentApi.uploadFile(created.id, file);
      }
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!title || !subject) {
      setError('Title and subject are required');
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

      <Card sx={{ maxWidth: 620 }}>
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
            <Box sx={{ display: 'flex', gap: 1.5, mb: 2.5 }}>
              {ContentTypeOptions.map((opt) => (
                <Box
                  key={opt.value}
                  onClick={() => setType(opt.value)}
                  sx={{
                    flex: 1,
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

            <TextField
              label="Content Body"
              fullWidth
              multiline
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={
                type === 'text'
                  ? 'Write your lesson content here...'
                  : 'Paste a URL for video/audio...'
              }
              sx={{ mb: 2.5 }}
            />

            {/* File upload */}
            <Box sx={{ mb: 3 }}>
              <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', mb: 1 }}>
                Upload File (optional)
              </Typography>
              <Button
                variant="outlined"
                component="label"
                size="small"
                sx={{ borderRadius: 2 }}
              >
                {file ? `📎 ${file.name}` : 'Choose File'}
                <input
                  type="file"
                  hidden
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </Button>
            </Box>

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
