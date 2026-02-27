import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  Checkbox,
  FormControlLabel,
  CircularProgress,
  Alert,
} from '@mui/material';
import GavelIcon from '@mui/icons-material/Gavel';
import TermsContent from './TermsContent';
import { usersApi } from '@/api/users';
import { useAuthStore } from '@/store/authStore';

interface Props {
  open: boolean;
}

export default function TermsModal({ open }: Props) {
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const updateUser = useAuthStore((s) => s.updateUser);

  const handleAccept = async () => {
    if (!agreed) return;
    setError('');
    setLoading(true);
    try {
      const updatedUser = await usersApi.acceptTerms();
      updateUser(updatedUser);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      maxWidth="md"
      fullWidth
      disableEscapeKeyDown
      onClose={() => {}}
      PaperProps={{
        sx: {
          borderRadius: 4,
          border: '2px solid',
          borderColor: 'divider',
        },
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <GavelIcon color="primary" />
          <Box>
            <Typography variant="h6" fontWeight={700} lineHeight={1.2}>
              Terms of Service &amp; User Agreement
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Please read and accept to continue using Nifty by Paragon
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0 }}>
        <Box
          sx={{
            maxHeight: '55vh',
            overflowY: 'auto',
            px: 3,
            py: 2,
            '&::-webkit-scrollbar': { width: 6 },
            '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 3 },
          }}
        >
          <TermsContent />
        </Box>
      </DialogContent>

      <DialogActions sx={{ flexDirection: 'column', alignItems: 'stretch', gap: 1, p: 2.5 }}>
        {error && (
          <Alert severity="error" sx={{ borderRadius: 2 }}>
            {error}
          </Alert>
        )}
        <FormControlLabel
          control={
            <Checkbox
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              disabled={loading}
            />
          }
          label={
            <Typography variant="body2">
              I have read and agree to the Terms of Service &amp; User Agreement
            </Typography>
          }
        />
        <Button
          variant="contained"
          size="large"
          disabled={!agreed || loading}
          onClick={handleAccept}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
        >
          Accept &amp; Continue →
        </Button>
      </DialogActions>
    </Dialog>
  );
}
