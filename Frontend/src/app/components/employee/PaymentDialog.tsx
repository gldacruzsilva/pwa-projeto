import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box,
  Typography, TextField, ToggleButtonGroup, ToggleButton, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow,
  Card, CardContent, Alert, IconButton, CircularProgress
} from '@mui/material';
import { CreditCard, AttachMoney, QrCode2, Delete, CheckCircle } from '@mui/icons-material';
import { toast } from 'sonner';
 
interface PaymentDialogProps {
  orderId: number;
  onClose: () => void;
  onOrderClosed?: () => void;
}

interface PaymentRecord {
  id: number;
  method: string;
  amount: number;
}

export default function PaymentDialog({ orderId, onClose, onOrderClosed }: PaymentDialogProps) {
  const [order, setOrder] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<'dinheiro' | 'debito' | 'credito' | 'pix'>('dinheiro');
  const [amount, setAmount] = useState('');
  const [payments, setPayments] = useState<PaymentRecord[]>([]);

  useEffect(() => {
    setIsLoading(true);
    fetch(`/api/comandas/${orderId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Erro na API');
        return res.json();
      })
      .then(data => {
        setOrder(data);
        setIsLoading(false);
      })
      .catch(() => {
        toast.error('Erro de conexão ao carregar dados.');
        setIsLoading(false);
      });
  }, [orderId]);

  const getMethodLabel = (method: string) => {
    const labels: Record<string, string> = { dinheiro: 'Dinheiro', debito: 'Débito', credito: 'Crédito', pix: 'PIX' };
    return labels[method] || method;
  };

  const total = order ? (Number(order.valor_total) || 0) : 0;
  const alreadyPaid = order ? (Number(order.totalPaid) || 0) : 0;
  const paymentsMade = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalPaid = alreadyPaid + paymentsMade;
  
  // 🟢 Arredondamento forçado para 2 casas decimais para anular a dízima do JavaScript
  const remaining = Math.round((total - totalPaid) * 100) / 100;

  const handleAddPayment = () => {
    // 🟢 Aceita caso o usuário digite com vírgula em vez de ponto
    const amountStr = String(amount).replace(',', '.');
    const amountValue = parseFloat(amountStr);
    
    if (isNaN(amountValue) || amountValue <= 0) return toast.error('Digite um valor válido');
    
    // 🟢 Validação blindada em centavos absolutos
    const valorEmCentavos = Math.round(amountValue * 100);
    const restanteEmCentavos = Math.round(remaining * 100);

    if (valorEmCentavos > restanteEmCentavos && paymentMethod !== 'dinheiro') {
      return toast.error('Valor maior que o restante permitido apenas em Dinheiro (Cálculo de Troco).');
    }

    const newPayment: PaymentRecord = {
      id: payments.length > 0 ? Math.max(...payments.map(p => p.id)) + 1 : 1,
      method: paymentMethod,
      amount: amountValue,
    };

    setPayments([...payments, newPayment]);
    setAmount('');
  };

  const handleRemovePayment = (id: number) => {
    setPayments(payments.filter(p => p.id !== id));
  };

  const handleConfirm = async () => {
    if (payments.length === 0) return toast.error('Adicione pelo menos um pagamento na lista');

    try {
      await fetch(`/api/comandas/${orderId}/pagamentos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pagamentos: payments })
      });

      if (remaining <= 0) {
        await fetch(`/api/comandas/${orderId}/fechar`, { method: 'PUT' });
        toast.success('Pagamento e fechamento realizados com sucesso');
        
        if (onOrderClosed) {
          onOrderClosed(); 
        } else {
          onClose();
        }
      } else {
        toast.success('Pagamento parcial realizado com sucesso');
        onClose(); 
      }
    } catch (error) {
      toast.error('Erro de conexão ao registrar pagamentos.');
    }
  };
  
  const nomeCliente = order ? (order.Nick || order.nick || 'Sem nome') : '';

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '12px', bgcolor: 'background.paper' } }}>
      <DialogTitle sx={{ borderBottom: 1, borderColor: 'divider', pb: 2 }}>
        Pagamento - Comanda #{orderId} {nomeCliente && `- ${nomeCliente}`}
      </DialogTitle>

      {isLoading ? (
        <DialogContent sx={{ p: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <CircularProgress size={40} />
          <Typography color="text.secondary">Carregando valores da comanda...</Typography>
        </DialogContent>
      ) : !order ? (
        <DialogContent sx={{ p: 4 }}>
          <Alert severity="error" sx={{ borderRadius: '8px' }}>
            Não foi possível comunicar com o Banco de Dados. Verifique se o backend está rodando sem erros.
          </Alert>
        </DialogContent>
      ) : (
        <DialogContent sx={{ p: 3, pt: 3 }}>
          
          {remaining > 0 ? (
            <Box sx={{ mb: 4 }}>
              <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>Adicionar Forma de Pagamento</Typography>
              <ToggleButtonGroup
                value={paymentMethod}
                exclusive
                onChange={(_, value) => value && setPaymentMethod(value)}
                fullWidth
                sx={{ mb: 3, '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 500 } }}
              >
                <ToggleButton value="dinheiro"><AttachMoney sx={{ mr: 1, fontSize: 20 }} /> Dinheiro</ToggleButton>
                <ToggleButton value="debito"><CreditCard sx={{ mr: 1, fontSize: 20 }} /> Débito</ToggleButton>
                <ToggleButton value="credito"><CreditCard sx={{ mr: 1, fontSize: 20 }} /> Crédito</ToggleButton>
                <ToggleButton value="pix"><QrCode2 sx={{ mr: 1, fontSize: 20 }} /> PIX</ToggleButton>
              </ToggleButtonGroup>

              <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                <TextField
                  fullWidth
                  label="Valor (R$)"
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,]/g, ''))}
                  placeholder="0.00"
                  size="small"
                />
                <Button 
                  variant="outlined" 
                  disableElevation 
                  onClick={() => setAmount(remaining > 0 ? remaining.toFixed(2) : '0.00')} 
                  sx={{ whiteSpace: 'nowrap', textTransform: 'none', fontWeight: 600 }}
                >
                  Pagar Tudo
                </Button>
              </Box>

              <Button
                fullWidth
                variant="contained"
                disableElevation
                onClick={handleAddPayment}
                disabled={!amount || parseFloat(amount.replace(',', '.')) <= 0}
                sx={{ py: 1.5, borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}
              >
                Adicionar à Lista de Pagamentos
              </Button>
            </Box>
          ) : (
            <Alert severity="success" icon={<CheckCircle />} sx={{ mb: 4, borderRadius: '8px', fontWeight: 500 }}>
              Comanda totalmente paga! Clique em Confirmar para encerrar.
            </Alert>
          )}

          {payments.length > 0 && (
            <Box sx={{ mb: 4 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>Pagamentos Registrados na Tela</Typography>
              <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: '8px' }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: 'action.hover' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Método</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>Valor</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 600 }}>Ação</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>{getMethodLabel(payment.method)}</TableCell>
                        <TableCell align="right">R$ {payment.amount.toFixed(2)}</TableCell>
                        <TableCell align="center">
                          <IconButton size="small" color="error" onClick={() => handleRemovePayment(payment.id)}>
                            <Delete fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          <Card elevation={0} sx={{ border: 1, borderColor: 'divider', bgcolor: 'background.default' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="body2" color="text.secondary" fontWeight={500}>Total da Comanda:</Typography>
                <Typography variant="h6" fontWeight={700}>R$ {total.toFixed(2)}</Typography>
              </Box>

              {alreadyPaid > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" fontWeight={500}>Já Pago Anteriormente:</Typography>
                  <Typography variant="body2" sx={{ color: 'success.main', fontWeight: 600 }}>R$ {alreadyPaid.toFixed(2)}</Typography>
                </Box>
              )}

              {payments.length > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" fontWeight={500}>Pagamentos Agora na Tela:</Typography>
                  <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 600 }}>R$ {paymentsMade.toFixed(2)}</Typography>
                </Box>
              )}

              <Box sx={{ borderTop: '1px dashed', borderColor: 'divider', pt: 2, mt: 1, display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body1" fontWeight={600}>
                  {remaining < 0 ? 'Troco:' : 'Restante:'}
                </Typography>
                <Typography variant="h6" color={remaining > 0 ? 'warning.main' : 'success.main'} fontWeight={700}>
                  R$ {Math.abs(remaining).toFixed(2)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </DialogContent>
      )}

      <DialogActions sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Button onClick={onClose} sx={{ textTransform: 'none', fontWeight: 600 }}>Cancelar</Button>
        <Button 
          variant="contained" 
          disableElevation 
          onClick={handleConfirm} 
          disabled={payments.length === 0 || isLoading || !order} 
          sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}
        >
          Confirmar 
        </Button>
      </DialogActions>
    </Dialog>
  );
}