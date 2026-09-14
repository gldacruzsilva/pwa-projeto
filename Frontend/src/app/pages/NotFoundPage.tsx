import { useNavigate } from 'react-router';
import { Container, Paper, Typography, Button, Box } from '@mui/material';
import { Home } from '@mui/icons-material';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <Container maxWidth="sm" className="flex items-center justify-center min-h-screen">
      <Paper elevation={3} className="p-8 w-full text-center">
        <Typography variant="h1" component="h1" className="mb-4">
          404
        </Typography>
        <Typography variant="h5" component="h2" className="mb-4">
          Página não encontrada
        </Typography>
        <Typography variant="body1" color="text.secondary" className="mb-6">
          A página que você está procurando não existe.
        </Typography>
        <Box>
          <Button
            variant="contained"
            size="large"
            startIcon={<Home />}
            onClick={() => navigate('/')}
          >
            Voltar ao Login
          </Button>
        </Box>
      </Paper>
    </Container>
  );
}
