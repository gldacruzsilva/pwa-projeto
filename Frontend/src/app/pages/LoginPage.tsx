import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress,
} from '@mui/material';
import { toast } from 'sonner';
import { API_URL } from '../../services/api';

export default function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const loginInProgress = useRef(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginInProgress.current) return;

    loginInProgress.current = true;
    setIsSubmitting(true);

    try {
      const resposta = await fetch(`/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: username,
          senha: password
        })
      });

      if (resposta.ok) {
        const usuarioLogado = await resposta.json(); 
        
        localStorage.setItem('usuarioAtivo', JSON.stringify(usuarioLogado));
        
        toast.success(`Bem-vindo, ${usuarioLogado.nome}!`);
        
        if (usuarioLogado.tipo === 'admin' || usuarioLogado.tipo === 'administrador') {
          navigate('/admin');
        } else {
          navigate('/funcionario');
        }
      } else {
        setError('Usuário ou senha incorretos. Verifique as credenciais.');
      }
    } catch (erro) {
      setError('Erro ao conectar com o servidor. Verifique se o backend está rodando.');
    } finally {
      loginInProgress.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <Container maxWidth="xs" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      
      <Paper elevation={4} sx={{ p: 4, width: '100%', borderRadius: 3 }}>
        
        <Box sx={{ mb: 4, textAlign: 'center' }}>
          
          <Typography variant="h5" component="h1" sx={{ fontWeight: 'bold', color: 'text.primary', mb: 1 }}>
            Gestão bar
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Faça login para acessar o sistema
          </Typography>
        </Box>

        <form onSubmit={handleLogin}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              fullWidth
              label="Usuário"
              variant="outlined"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError('');
              }}
              required
              disabled={isSubmitting}
              InputLabelProps={{ shrink: true }}
            />

            <TextField
              fullWidth
              label="Senha"
              type="password"
              variant="outlined"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              required
              disabled={isSubmitting}
              InputLabelProps={{ shrink: true }}
            />

            {error && (
              <Alert severity="error" sx={{ mt: 1 }}>
                {error}
              </Alert>
            )}

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={isSubmitting}
              sx={{ py: 1.5, fontWeight: 'bold', textTransform: 'none', fontSize: '1rem', mt: 1 }}
            >
              {isSubmitting ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={20} color="inherit" />
                  Entrando...
                </Box>
              ) : 'Entrar'}
            </Button>
          </Box>
        </form>

       
      </Paper>
    </Container>
  );
}