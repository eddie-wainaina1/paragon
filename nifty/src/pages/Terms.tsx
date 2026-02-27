import { Box, Container, Typography, Button, Divider } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Link as RouterLink } from 'react-router-dom';
import TermsContent from '@/components/Terms/TermsContent';

export default function Terms() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', py: 4 }}>
      <Container maxWidth="md">
        <Button
          component={RouterLink}
          to="/"
          startIcon={<ArrowBackIcon />}
          sx={{ mb: 3 }}
          variant="text"
        >
          Back to Home
        </Button>

        <Box
          sx={{
            border: '2px solid',
            borderColor: 'divider',
            borderRadius: 4,
            p: { xs: 3, md: 5 },
            bgcolor: 'background.paper',
          }}
        >
          <Typography variant="h4" fontWeight={800} gutterBottom>
            Terms of Service &amp; User Agreement
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Nifty by Paragon
          </Typography>
          <Divider sx={{ my: 3 }} />
          <TermsContent />
        </Box>
      </Container>
    </Box>
  );
}
