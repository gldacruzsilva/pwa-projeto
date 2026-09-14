import { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  InputAdornment,
  Alert,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button
} from '@mui/material';
import { Search, Delete, ReceiptLong } from '@mui/icons-material';
import OrderDetailDialog from './OrderDetailDialog';
import { toast } from 'sonner';

interface ComandaBanco {
  codc: number;
  Nick: string;
  valor_total: string | number;
  data_venda: string;
  valor_pago?: string | number;
}

export default function OrdersListTab() {
  const [orders, setOrders] = useState<ComandaBanco[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  
  // 🟢 Controle do Modal de Exclusão customizado
  const [orderToDelete, setOrderToDelete] = useState<{ id: number, name: string } | null>(null);

 const fetchOrders = async () => {
    try {
      const response = await fetch('/api/comandas');
      if (response.ok) {
        const data = await response.json();
        // Garante que setOrders receba uma Array, mesmo que a API retorne um objeto
        setOrders(Array.isArray(data) ? data : data.comandas || data.data || []);
      }
    } catch (error) {
      console.error('Erro ao carregar comandas do banco de dados.');
    }
  };

  useEffect(() => {
    fetchOrders(); 
    const interval = setInterval(fetchOrders, 2000); 
    return () => clearInterval(interval); 
  }, []);

  const executeDeleteOrder = async () => {
    if (!orderToDelete) return;

    try {
      const response = await fetch(`/api/comandas/${orderToDelete.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success(`Comanda de ${orderToDelete.name} excluída.`);
        setOrderToDelete(null); // Fecha o modal
        fetchOrders(); 
      } else {
        const errorData = await response.json();
        toast.error(errorData.mensagem || 'Erro ao excluir comanda.');
      }
    } catch (error) {
      toast.error('Erro de conexão com o servidor.');
    }
  };
const filteredOrders = orders.filter(order => {
    const nomeCliente = order.Nick || (order as any).nick || '';
    return nomeCliente.toLowerCase().includes((searchTerm || '').toLowerCase());
  });
  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: '1300px', mx: 'auto' }}>
      
      {/* BARRA DE PESQUISA INTELIGENTE (Adapta ao tema) */}
      <TextField
        fullWidth
        placeholder="Buscar comanda pelo nome do cliente..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        sx={{
          mb: 4,
          '& .MuiOutlinedInput-root': {
            borderRadius: '12px',
            backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#f8fafc',
            boxShadow: '0px 2px 4px rgba(0,0,0,0.02)',
            '& fieldset': { borderColor: (theme) => theme.palette.divider },
            '&:hover fieldset': { borderColor: (theme) => theme.palette.mode === 'dark' ? '#94a3b8' : '#cbd5e1' },
            '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
          }
        }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Search sx={{ color: 'text.secondary' }} />
            </InputAdornment>
          ),
        }}
      />

      {/* LISTA DE COMANDAS */}
      {filteredOrders.length === 0 ? (
        <Alert severity="info" sx={{ borderRadius: '8px' }}>
          {searchTerm ? 'Nenhuma comanda encontrada com esse nome.' : 'Não há comandas abertas no momento.'}
        </Alert>
      ) : (
        
        <Grid container spacing={3}>
          {filteredOrders.map(order => {
            // 🟢 Captura o nome independente de como vem do banco (Nick ou nick)
            const nomeCliente = order.Nick || (order as any).nick || 'Sem nome';
            
            const valorTotal = Number(order.valor_total) || 0;
            const valorPago = Number(order.valor_pago) || 0;
            const restante = valorTotal - valorPago;
            
            const comandaZerada = valorTotal === 0;
            const temPagamentoParcial = valorPago > 0 && restante > 0;

            return (
             <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={String(order.codc)}>
                <Card 
                  elevation={0}
                  sx={{ 
                    height: '100%', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    borderRadius: '12px', 
                    border: 1,
                    borderColor: 'divider',
                    backgroundColor: 'background.paper',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer',
                    '&:hover': {
                      borderColor: temPagamentoParcial ? '#f59e0b' : '#3b82f6',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'
                    }
                  }}
              onClick={() => setSelectedOrderId(order.codc)}
                >
                  <CardContent 
                    sx={{ 
                      p: 3, 
                      '&:last-child': { pb: 3 }, 
                      flexGrow: 1, 
                      display: 'flex', 
                      flexDirection: 'column' 
                    }}
                  >
                    
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                      <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0, flex: 1, mr: 1 }}>
                        <ReceiptLong sx={{ color: 'text.secondary', fontSize: 20, mr: 1, flexShrink: 0 }} />
                       {/* 🟢 Onde o nome é exibido no topo do Card */}
                        <Typography 
                          noWrap 
                          title={nomeCliente} 
                          sx={{ fontWeight: 600, color: 'text.primary', lineHeight: 1.2 }}
                        >
                          {nomeCliente}
                        </Typography>
                      </Box>
                      
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexShrink: 0 }}>
                        <Chip
                          label={comandaZerada ? "Nova" : "Aberta"}
                          size="small"
                          sx={{ 
                            fontWeight: 600,
                            bgcolor: (theme) => comandaZerada 
                              ? (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : '#f1f5f9') 
                              : (theme.palette.mode === 'dark' ? 'rgba(59, 130, 246, 0.2)' : '#eff6ff'),
                            color: comandaZerada 
                              ? 'text.secondary' 
                              : (theme => theme.palette.mode === 'dark' ? '#60a5fa' : '#3b82f6')
                          }}
                        />
                        {comandaZerada && (
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation(); 
                              // 🟢 Abre o Modal ao invés do window.confirm nativo
                              setOrderToDelete({ id: order.codc, name: order.Nick });
                            }}
                            sx={{ color: '#ef4444', padding: '4px', '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.1)' } }}
                          >
                            <Delete sx={{ fontSize: 18 }} />
                          </IconButton>
                        )}
                      </Box>
                    </Box>

                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                      Comanda #{order.codc}
                    </Typography>
                    
                    <Box sx={{ flexGrow: 1 }} />
                    
                    <Box sx={{ pt: 2, mt: 1, borderTop: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                      <Box>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          {temPagamentoParcial ? 'Restante:' : 'Valor Total:'}
                        </Typography>
                        {temPagamentoParcial && (
                          <Typography variant="caption" sx={{ color: '#10b981', fontWeight: 600 }}>
                            Já pago: R$ {valorPago.toFixed(2)}
                          </Typography>
                        )}
                      </Box>
                      <Typography 
                        variant="h6" 
                        sx={{ 
                          color: comandaZerada ? 'text.secondary' : (temPagamentoParcial ? '#f59e0b' : '#10b981'), 
                          fontWeight: 700, 
                          lineHeight: 1 
                        }}
                      >
                        R$ {restante.toFixed(2)}
                      </Typography>
                    </Box>

                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* MODAL DE DETALHES DA COMANDA */}
      {selectedOrderId !== null && (
        <OrderDetailDialog
          orderId={selectedOrderId}
          onClose={() => {
            setSelectedOrderId(null);
            fetchOrders(); 
          }}
        />
      )}

      {/* 🟢 MODAL PROFISSIONAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      <Dialog 
        open={!!orderToDelete} 
        onClose={() => setOrderToDelete(null)} 
        PaperProps={{ sx: { borderRadius: '12px', p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          Excluir Comanda?
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            Deseja realmente excluir a comanda de <strong>{orderToDelete?.name}</strong>? Esta ação não pode ser desfeita.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOrderToDelete(null)} sx={{ fontWeight: 600, color: 'text.secondary' }}>Cancelar</Button>
          <Button 
            onClick={executeDeleteOrder} 
            variant="contained" 
            color="error"
            disableElevation
            sx={{ fontWeight: 600 }}
          >
            Excluir
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}