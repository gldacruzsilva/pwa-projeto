import { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Paper,
  Typography,
  Alert,
} from '@mui/material';
import { PersonAddAlt1 } from '@mui/icons-material';
import { toast } from 'sonner';

interface NewOrderTabProps {
  onOrderCreated: () => void;
}

export default function NewOrderTab({ onOrderCreated }: NewOrderTabProps) {
  const [customerName, setCustomerName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName.trim()) {
      toast.error('Digite o nome do cliente ou da mesa');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/comandas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nick: customerName.trim() }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`Comanda #${data.codc} criada com sucesso para ${customerName}!`);
        setCustomerName('');
        
        // Atualiza a lista de comandas na outra aba automaticamente
        onOrderCreated(); 
      } else {
        const errorData = await response.json();
        toast.error(errorData.mensagem || 'Erro ao criar a comanda.');
      }
    } catch (error) {
      toast.error('Erro de conexão com o servidor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const modernInputStyle = {
    '& .MuiOutlinedInput-root': {
      borderRadius: '8px',
      backgroundColor: (theme: any) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#f8fafc',
      '& fieldset': { borderColor: (theme: any) => theme.palette.divider },
      '&:hover fieldset': { borderColor: (theme: any) => theme.palette.mode === 'dark' ? '#94a3b8' : '#cbd5e1' },
      '&.Mui-focused fieldset': { borderColor: '#3b82f6', borderWidth: '1px' },
    },
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: '1400px', mx: 'auto' }}>
      <Box mb={4}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 600, color: 'text.primary', letterSpacing: '-0.5px' }}>
          
        </Typography>
      </Box>

      {/* 🟢 O segredo estava aqui no bgcolor: agora usa o background nativo do tema! */}
      <Paper elevation={0} sx={{ p: 4, borderRadius: '12px', border: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Alert severity="info" sx={{ mb: 4, borderRadius: '8px' }}>
          Digite o nome do cliente ou da mesa para abrir uma nova comanda. 
        </Alert>

        <form onSubmit={handleCreateOrder}>
          <Box display="flex" flexDirection="column" gap={3}>
            <TextField
              fullWidth
              label="Nome do Cliente*"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              inputProps={{ maxLength: 45 }}
              helperText={`${customerName.length}/45 caracteres`}
              sx={modernInputStyle}
              autoFocus
            />

            <Button
              type="submit"
              variant="contained"
              disableElevation
              disabled={isSubmitting || !customerName.trim()}
              startIcon={<PersonAddAlt1 />}
              sx={{
                py: 1.5,
                borderRadius: '8px',
                fontWeight: 600,
                textTransform: 'none',
                fontSize: '1rem',
              }}
            >
              {isSubmitting ? 'Criando...' : 'CRIAR COMANDA'}
            </Button>
          </Box>
        </form>
      </Paper>
    </Box>
  );
}