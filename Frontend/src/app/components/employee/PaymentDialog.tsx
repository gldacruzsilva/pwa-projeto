import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box,
  Typography, TextField, ToggleButton, Table, DialogContentText,
  TableBody, TableCell, TableContainer, TableHead, TableRow,
  Card, CardContent, Alert, IconButton, CircularProgress, Tooltip
} from '@mui/material';
import { CreditCard, Close, AttachMoney, QrCode2, Delete, CheckCircle, Add, HelpOutline, Settings } from '@mui/icons-material';
import { toast } from 'sonner';
import { apiUrl } from '../../../services/api';

interface PaymentDialogProps {
  orderId: number;
  onClose: () => void;
  onOrderClosed?: () => void;
}

interface PaymentRecord {
  id: number;
  codtp: number;
  method: string;
  amount: number;
}

interface PaymentType {
  codtp: number;
  descricao: string;
}

export default function PaymentDialog({ orderId, onClose, onOrderClosed }: PaymentDialogProps) {
  const [order, setOrder] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [paymentTypes, setPaymentTypes] = useState<PaymentType[]>([]);
  const [isLoadingPaymentTypes, setIsLoadingPaymentTypes] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<number | null>(null);
  const [isManagingPaymentTypes, setIsManagingPaymentTypes] = useState(false);
  const [isAddingPaymentType, setIsAddingPaymentType] = useState(false);
  const [newPaymentType, setNewPaymentType] = useState('');
  const [isSavingPaymentType, setIsSavingPaymentType] = useState(false);
  const [paymentTypeToDeactivate, setPaymentTypeToDeactivate] = useState<PaymentType | null>(null);
  const [isDeactivatingPaymentType, setIsDeactivatingPaymentType] = useState(false);
  const [amount, setAmount] = useState('');
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
 

  useEffect(() => {
    setIsLoading(true);
    fetch(apiUrl(`/api/comandas/${orderId}`))
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

  useEffect(() => {
    let active = true;
    fetch(apiUrl('/api/tipos-pagamento'))
      .then(async (response) => {
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          throw new Error('Não foi possível carregar as formas de pagamento. Reinicie o backend para aplicar as alterações.');
        }
        const data = await response.json();
        if (!response.ok) throw new Error(data.mensagem || 'Erro ao carregar formas de pagamento.');
        if (!Array.isArray(data)) throw new Error('A resposta das formas de pagamento é inválida.');
        if (!active) return;

        const types: PaymentType[] = data;
        setPaymentTypes(types);
        const preferredType = types.find((type) => type.descricao.toLocaleLowerCase('pt-BR') === 'dinheiro') || types[0];
        setPaymentMethod(preferredType?.codtp ?? null);
      })
      .catch((error) => {
        if (active) {
          toast.error(error instanceof Error ? error.message : 'Erro ao carregar formas de pagamento.');
        }
      })
      .finally(() => {
        if (active) setIsLoadingPaymentTypes(false);
      });

    return () => { active = false; };
  }, []);

  const getMethodIcon = (description: string) => {
    const normalized = description.toLocaleLowerCase('pt-BR');
    if (normalized.includes('dinheiro')) return <AttachMoney sx={{ mr: 1, fontSize: 20 }} />;
    if (normalized.includes('pix')) return <QrCode2 sx={{ mr: 1, fontSize: 20 }} />;
    return <CreditCard sx={{ mr: 1, fontSize: 20 }} />;
  };

  const total = order ? (Number(order.valor_total) || 0) : 0;
  const alreadyPaid = order ? (Number(order.totalPaid) || 0) : 0;
  const paymentsMade = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalPaid = alreadyPaid + paymentsMade;
  
  const remaining = Math.round((total - totalPaid) * 100) / 100;

  const handleAddPayment = () => {
    const selectedType = paymentTypes.find((type) => type.codtp === paymentMethod);
    if (!selectedType) return toast.error('Selecione uma forma de pagamento.');

    const amountStr = String(amount).replace(',', '.');
    const amountValue = parseFloat(amountStr);
    
    if (isNaN(amountValue) || amountValue <= 0) return toast.error('Digite um valor válido');
    
    const valorEmCentavos = Math.round(amountValue * 100);
    const restanteEmCentavos = Math.round(remaining * 100);

    const isCashPayment = selectedType.descricao.toLocaleLowerCase('pt-BR') === 'dinheiro';
    if (valorEmCentavos > restanteEmCentavos && !isCashPayment) {
      return toast.error('Valor maior que o restante permitido apenas em Dinheiro (Cálculo de Troco).');
    }

    const newPayment: PaymentRecord = {
      id: payments.length > 0 ? Math.max(...payments.map(p => p.id)) + 1 : 1,
      codtp: selectedType.codtp,
      method: selectedType.descricao,
      amount: amountValue,
    };

    setPayments([...payments, newPayment]);
    setAmount('');
  };

  const handleRemovePayment = (id: number) => {
    setPayments(payments.filter(p => p.id !== id));
  };

  const handleDeactivatePaymentType = async () => {
    if (!paymentTypeToDeactivate) return;

    setIsDeactivatingPaymentType(true);
    try {
      const response = await fetch(apiUrl(`/api/tipos-pagamento/${paymentTypeToDeactivate.codtp}`), {
        method: 'DELETE',
      });
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('Resposta inválida ao remover a forma de pagamento.');
      }
      const result = await response.json();
      if (!response.ok) throw new Error(result.mensagem || 'Não foi possível remover a forma de pagamento.');

      const remainingTypes = paymentTypes.filter((type) => type.codtp !== paymentTypeToDeactivate.codtp);
      setPaymentTypes(remainingTypes);
      setPaymentMethod((current) => (
        current === paymentTypeToDeactivate.codtp ? remainingTypes[0]?.codtp ?? null : current
      ));
      toast.success('Forma de pagamento removida da seleção. O histórico foi preservado.');
      setPaymentTypeToDeactivate(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao remover forma de pagamento.');
    } finally {
      setIsDeactivatingPaymentType(false);
    }
  };

 const handleCreatePaymentType = async () => {
    const description = newPaymentType.trim();
    if (!description) return toast.error('Informe o nome da nova forma de pagamento.');
    if (description.length > 45) return toast.error('O nome deve ter no máximo 45 caracteres.');

    setIsSavingPaymentType(true);
    try {
      const response = await fetch(apiUrl('/api/tipos-pagamento'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descricao: description }),
      });
      
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('A API não reconheceu o cadastro de formas de pagamento.');
      }
      
      const result = await response.json();
      if (!response.ok) throw new Error(result.mensagem || 'Não foi possível cadastrar a forma de pagamento.');

      const createdType: PaymentType = {
        codtp: Number(result.codtp),
        descricao: result.descricao,
      };
      if (!Number.isInteger(createdType.codtp) || !createdType.descricao) {
        throw new Error('A API retornou dados inválidos para a forma de pagamento.');
      }
      setPaymentTypes((currentTypes) => (
        [...currentTypes.filter((type) => type.codtp !== createdType.codtp), createdType]
          .sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR'))
      ));
      setPaymentMethod(createdType.codtp);

      setNewPaymentType('');
      setIsAddingPaymentType(false);
      setIsManagingPaymentTypes(false);
      toast.success('Forma de pagamento adicionada.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao cadastrar forma de pagamento.');
    } finally {
      setIsSavingPaymentType(false);
    }
  };

  const handleConfirm = async () => {
    if (payments.length === 0) return toast.error('Adicione pelo menos um pagamento na lista');

    try {
      const response = await fetch(apiUrl(`/api/comandas/${orderId}/pagamentos`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pagamentos: payments })
      });
      if (!(response.headers.get('content-type') || '').includes('application/json')) {
        throw new Error('Resposta inválida da API de pagamentos. Reinicie o backend e tente novamente.');
      }
      const result = await response.json();
      if (!response.ok) throw new Error(result.mensagem || 'Não foi possível registrar os pagamentos.');

      if (remaining <= 0) {
        const closeResponse = await fetch(apiUrl(`/api/comandas/${orderId}/fechar`), { method: 'PUT' });
        if (!closeResponse.ok) throw new Error('Pagamento registrado, mas não foi possível fechar a comanda.');
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
      toast.error(error instanceof Error ? error.message : 'Erro de conexão ao registrar pagamentos.');
    }
  };
  
  const nomeCliente = order ? (order.Nick || order.nick || 'Sem nome') : '';

  return (
    <>
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '12px', bgcolor: 'background.paper' } }}>
      <DialogTitle sx={{ borderBottom: 1, borderColor: 'divider', pb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          Pagamento - Comanda #{order?.numero_exibicao ?? orderId} {nomeCliente && `- ${nomeCliente}`}
        </Box>
        <Tooltip 
          title="Selecione a forma de pagamento, digite o valor e clique em Adicionar. Para pagamentos mistos, adicione um por vez antes de confirmar. O botão 'Pagar Tudo' preenche o valor restante da comanda. O restante será calculado automaticamente, e se houver troco, ele será exibido." 
          arrow 
          placement="bottom-end"
        >
          <IconButton size="small" sx={{ color: 'text.secondary' }}>
            <HelpOutline fontSize="small" />
          </IconButton>
        </Tooltip>
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
              
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5, gap: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Forma de Pagamento</Typography>
        <Tooltip title="Adicionar ou remover formas de pagamento" arrow>
          <IconButton
            size="small"
            aria-label={isManagingPaymentTypes ? 'Fechar configurações das formas de pagamento' : 'Configurar formas de pagamento'}
            onClick={() => {
              setIsManagingPaymentTypes((current) => !current);
              setIsAddingPaymentType(false);
              setNewPaymentType('');
            }}
            sx={{ width: 24, height: 24, bgcolor: 'action.hover' }}
          >
            {isManagingPaymentTypes ? <Close sx={{ fontSize: 16 }} /> : <Settings sx={{ fontSize: 16 }} />}
          </IconButton>
        </Tooltip>
      </Box>

      {isLoadingPaymentTypes ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
          <CircularProgress size={24} />
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
          {paymentTypes.map((type) => {
            const hasPendingPayment = payments.some((payment) => payment.codtp === type.codtp);
            return (
              <Box key={type.codtp} sx={{ display: 'flex', alignItems: 'stretch' }}>
                <ToggleButton
                  selected={paymentMethod === type.codtp}
                  value={type.codtp}
                  onChange={(_, selected) => {
                    if (selected) setPaymentMethod(type.codtp);
                  }}
                  aria-label={type.descricao}
                  sx={{ textTransform: 'none', borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
                >
                  {getMethodIcon(type.descricao)}
                  {type.descricao}
                </ToggleButton>
                {isManagingPaymentTypes && (
                  <Tooltip
                    title={hasPendingPayment
                      ? 'Remova o pagamento pendente antes de inativar esta forma.'
                      : `Inativar ${type.descricao}`}
                    arrow
                  >
                    <span>
                      <IconButton
                        size="small"
                        color="error"
                        aria-label={`Inativar ${type.descricao}`}
                        disabled={hasPendingPayment || isDeactivatingPaymentType}
                        onClick={() => setPaymentTypeToDeactivate(type)}
                        sx={{
                          height: '100%',
                          border: 1,
                          borderColor: 'divider',
                          borderLeft: 0,
                          borderTopLeftRadius: 0,
                          borderBottomLeftRadius: 0,
                        }}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                )}
              </Box>
            );
          })}
        </Box>
      )}

      {isManagingPaymentTypes && (
        <Box sx={{ mb: 2 }}>
          {!isAddingPaymentType && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<Add />}
              onClick={() => setIsAddingPaymentType(true)}
              sx={{ textTransform: 'none' }}
            >
              Adicionar forma de pagamento
            </Button>
          )}
        </Box>
      )}

      {isManagingPaymentTypes && isAddingPaymentType && (
        <Box sx={{ mb: 3, p: 2, border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: 'action.hover' }}>
          <Typography variant="caption" fontWeight="bold" display="block" mb={1}>Cadastrar nova forma de pagamento</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              size="small"
              value={newPaymentType}
              onChange={(event) => setNewPaymentType(event.target.value)}
              inputProps={{ maxLength: 45 }}
              autoFocus
              sx={{ bgcolor: 'background.paper' }}
            />
            <Button
              variant="outlined"
              color="primary"
              onClick={() => {
                setIsAddingPaymentType(false);
                setNewPaymentType('');
              }}
              sx={{ textTransform: 'none' }}
            >
              Cancelar
            </Button>
            <Button
              variant="contained"
              disableElevation
              onClick={handleCreatePaymentType}
              disabled={isSavingPaymentType || !newPaymentType.trim()}
              sx={{ whiteSpace: 'nowrap', textTransform: 'none' }}
            >
              {isSavingPaymentType ? <CircularProgress size={20} color="inherit" /> : 'Salvar'}
            </Button>
          </Box>
        </Box>
      )}

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
                      disabled={!amount || parseFloat(amount.replace(',', '.')) <= 0 || paymentMethod === null || isLoadingPaymentTypes}
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
                        <TableCell>{payment.method}</TableCell>
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
    <Dialog
      open={!!paymentTypeToDeactivate}
      onClose={() => {
        if (!isDeactivatingPaymentType) setPaymentTypeToDeactivate(null);
      }}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle>Remover forma de pagamento?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          {paymentTypeToDeactivate?.descricao} deixará de aparecer para novos pagamentos. Os pagamentos já registrados e os relatórios serão preservados.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => setPaymentTypeToDeactivate(null)}
          disabled={isDeactivatingPaymentType}
        >
          Cancelar
        </Button>
        <Button
          color="error"
          variant="contained"
          onClick={handleDeactivatePaymentType}
          disabled={isDeactivatingPaymentType}
        >
          {isDeactivatingPaymentType ? <CircularProgress size={20} color="inherit" /> : 'Remover'}
        </Button>
      </DialogActions>
    </Dialog>
    </>
  );
}