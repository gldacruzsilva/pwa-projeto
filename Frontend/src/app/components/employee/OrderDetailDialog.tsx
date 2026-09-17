import { useState, useRef, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box,
  Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, IconButton, TextField, Tabs, Tab,
  Grid, Card, CardContent, Chip, Autocomplete, Alert,
} from '@mui/material';
import { Close, Add, Remove, Delete, Payment, QrCodeScanner, TrendingUp } from '@mui/icons-material';
import { toast } from 'sonner';
import PaymentDialog from './PaymentDialog';

interface OrderDetailDialogProps {
  orderId: number;
  onClose: () => void;
}

interface ProdutoBanco {
  codp: number;
  nome: string;
  preco_custo?: number;
  preco_venda?: number;
  qtde_estoque: number;
  lote?: string;
}

interface ItemComanda {
  codp: number;
  nome: string;
  qtde: number | string;
  valor_unit: string;
}

interface ComandaDetalhada {
  codv?: number;
  codc?: number;
  Nick?: string;
  nick?: string;
  data_venda: string;
  valor_total: string;
  itens: ItemComanda[];
}

export default function OrderDetailDialog({ orderId, onClose }: OrderDetailDialogProps) {
  const [order, setOrder] = useState<ComandaDetalhada | null>(null);
  const [products, setProducts] = useState<ProdutoBanco[]>([]);
  
  const [addMode, setAddMode] = useState<'barcode' | 'search' | 'popular'>('barcode');
  const [barcode, setBarcode] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [selectedProduct, setSelectedProduct] = useState<ProdutoBanco | null>(null);
  const [openPayment, setOpenPayment] = useState(false);
  
  const [ativoToDelete, setItemToDelete] = useState<{ codp: number, nome: string } | null>(null);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    try {
      const [resOrder, resProducts] = await Promise.all([
        fetch(`/api/comandas/${orderId}`),
        fetch('/api/produtos')
      ]);

      if (resOrder.ok) setOrder(await resOrder.json());

      if (resProducts.ok) {
        const data = await resProducts.json();
        // Garante que é um array, mesmo se a API envelopar em "produtos" ou "data"
        setProducts(Array.isArray(data) ? data : data.produtos || data.data || []);
      }

    } catch (error) {
      toast.error('Erro ao carregar os dados da comanda.');
    }
  };

  useEffect(() => {
    fetchData();
  }, [orderId]);

  useEffect(() => {
    if (addMode === 'barcode' && barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [addMode]);

  if (!order) return null;

  const nomeCliente = order.Nick || order.nick || 'Sem nome';
  const codigoComanda = order.codv || order.codc || orderId;

  const popularProducts = [...products].slice(0, 6);

  const handleAddItem = async (codp: number, qtde: number, nome: string) => {
    try {
      const response = await fetch(`/api/comandas/${orderId}/itens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codp, qtde })
      });
      
      if (response.ok) {
        toast.success(`${qtde}x ${nome} adicionado`);
        fetchData(); 
      } else {
        const errorData = await response.json();
        toast.error(errorData.mensagem || 'Erro ao adicionar ativo.'); 
      }
    } catch (error) {
      toast.error('Erro de conexão ao adicionar produto.');
    }
  };

  const handleUpdateQuantity = async (codp: number, currentQty: number | string, delta: number) => {
    const newQty = Number(currentQty) + delta;
    if (newQty <= 0) return;

    try {
      const response = await fetch(`/api/comandas/${orderId}/itens/${codp}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qtde: newQty })
      });
      
      if (response.ok) {
        fetchData();
      } else {
        const errorData = await response.json();
        toast.error(errorData.mensagem || 'Erro ao atualizar quantidade.');
      }
    } catch (error) {
      toast.error('Erro de conexão ao atualizar quantidade.');
    }
  };

  const executeRemoveItem = async () => {
    if (!ativoToDelete) return;

    try {
      const response = await fetch(`/api/comandas/${orderId}/itens/${ativoToDelete.codp}`, { method: 'DELETE' });
      
      if (response.ok) {
        toast.success('Item removido e devolvido ao estoque.');
        setItemToDelete(null);
        fetchData();
      } else {
        toast.error('Erro ao remover ativo.');
      }
    } catch (error) {
      toast.error('Erro de conexão ao remover ativo.');
    }
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcode.trim()) return;

    const product = products.find(p => p.codp.toString() === barcode.trim());
    if (!product) {
      toast.error('Produto não encontrado');
      setBarcode('');
      return;
    }

    const qty = parseInt(quantity);
    if (qty > 0) handleAddItem(product.codp, qty, product.nome);
    
    setBarcode('');
    setQuantity('1');
    barcodeInputRef.current?.focus();
  };

  const handleSearchAdd = () => {
  if (!selectedProduct) return toast.error('Selecione um produto');
  
  const qty = parseInt(quantity);
  
  if (qty > 0) {
    // 🟢 Agora usamos as propriedades direto do objeto armazenado no estado
    handleAddItem(selectedProduct.codp, qty, selectedProduct.nome);
    setSelectedProduct(null);
    setQuantity('1');
  }
};

  const total = Number(order.valor_total) || 0;
  const totalPaid = Number((order as any).totalPaid) || 0; 
  const remaining = total - totalPaid;

  return (
    <>
      <Dialog open onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: '12px', bgcolor: 'background.paper' } }}>
        <DialogTitle sx={{ borderBottom: 1, borderColor: 'divider', pb: 2 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Comanda #{codigoComanda} - {nomeCliente}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Aberta em {new Date(order.data_venda).toLocaleString('pt-BR')}
              </Typography>
            </Box>
            <IconButton 
                onClick={onClose} 
                sx={{ 
                  color: '#ef4444', 
                  bgcolor: 'rgba(239, 68, 68, 0.15)', 
                  '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.25)' } 
                }}
              >
                <Close />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 3, pt: 3 }}>
          
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, fontSize: '1.1rem' }}>Lançar Produtos</Typography>

            <Tabs value={addMode} onChange={(_, v) => setAddMode(v)} sx={{ mb: 3, minHeight: '40px', '& .MuiTab-root': { minHeight: '40px', textTransform: 'none', fontWeight: 500 } }}>
              <Tab icon={<QrCodeScanner sx={{ fontSize: 20 }} />} iconPosition="start" label="Código de Barras" value="barcode" />
              <Tab icon={<Add sx={{ fontSize: 20 }} />} iconPosition="start" label="Pesquisar" value="search" />
              <Tab icon={<TrendingUp sx={{ fontSize: 20 }} />} iconPosition="start" label="Sugestões" value="popular" />
            </Tabs>

            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
              <TextField
                label="Qtd"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                inputProps={{ min: 1 }}
                size="small"
                sx={{ width: '80px' }}
              />

              <Box sx={{ flexGrow: 1 }}>
                {addMode === 'barcode' && (
                  <form onSubmit={handleBarcodeSubmit} style={{ display: 'flex', gap: '8px' }}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Código de Barras"
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                      inputRef={barcodeInputRef}
                      placeholder="Escaneie o produto..."
                    />
                    <Button type="submit" variant="contained" disableElevation>Inserir</Button>
                  </form>
                )}

          {addMode === 'search' && (
            <Box display="flex" gap={1}>
              <Autocomplete
                fullWidth
                size="small"
                options={products}
                // 🟢 Compara Código E Lote para evitar conflitos de "chaves duplicadas"
                isOptionEqualToValue={(option, value) => option.codp === value.codp && option.lote === value.lote}
                getOptionLabel={(option) => 
                  `${option.nome ?? 'Sem nome'} - R$ ${Number(option.preco_venda || 0).toFixed(2)} (Estoque: ${option.qtde_estoque ?? 0})`
                }
                renderInput={(params) => <TextField {...params} label="Buscar pelo nome..." variant="outlined" />}
                // 🟢 Fica muito mais limpo recebendo e enviando o objeto inteiro
                value={selectedProduct}
                onChange={(_, newValue) => setSelectedProduct(newValue)}
              />
              <Button variant="contained" disableElevation onClick={handleSearchAdd}>Inserir</Button>
            </Box>
          )}

                {addMode === 'popular' && (
                  <Grid container spacing={1}>
                    {popularProducts.map((product) => (
                      <Grid size={{ xs: 12, sm: 4 }} key={product.codp}>
                        <Card 
                          elevation={0}
                          sx={{ 
                            border: 1, 
                            borderColor: 'divider', 
                            cursor: 'pointer', 
                            bgcolor: 'background.default',
                            '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' } 
                          }}
                          onClick={() => handleAddItem(product.codp, parseInt(quantity) || 1, product.nome)}
                        >
                          <CardContent sx={{ p: 1, '&:last-child': { pb: 1 }, textAlign: 'center' }}>
                            <Typography variant="caption" sx={{ fontWeight: 600, mb: 0.5, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {product.nome}
                            </Typography>
                            <Box display="flex" flexDirection="column" gap={0.5} alignItems="center">
                              <Chip 
                                label={`R$ ${Number(product.preco_venda || 0).toFixed(2)}`} 
                                size="small" 
                                color="primary" 
                                variant="outlined" 
                                sx={{ height: '20px', fontSize: '0.7rem' }} 
                              />
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                                Est: {product.qtde_estoque}
                              </Typography>
                            </Box>
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                )}
              </Box>
            </Box>
          </Box>

          <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 3, mb: 4 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, fontSize: '1.1rem' }}>Itens </Typography>

            {order.itens.length === 0 ? (
              <Alert severity="info" sx={{ mb: 4, borderRadius: '8px' }}>
                Nenhum ativo adicionado ainda. Use as opções acima para lançar produtos.
              </Alert>
            ) : (
              <TableContainer sx={{ mb: 4, border: 1, borderColor: 'divider', borderRadius: '8px' }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: 'action.hover' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Produto</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 600 }}>Qtd</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>Preço Unit.</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>Subtotal</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 600 }}>Remover</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {order.itens.map((ativo) => (
                      <TableRow key={ativo.codp}>
                        <TableCell>{ativo.nome}</TableCell>
                        <TableCell align="center">
                          <Box display="flex" alignItems="center" justifyContent="center" gap={1}>
                            <IconButton size="small" onClick={() => handleUpdateQuantity(ativo.codp, ativo.qtde, -1)} disabled={Number(ativo.qtde) <= 1}><Remove fontSize="small" /></IconButton>
                            <Typography sx={{ minWidth: '24px', textAlign: 'center', fontWeight: 500 }}>{Number(ativo.qtde)}</Typography>
                            <IconButton size="small" onClick={() => handleUpdateQuantity(ativo.codp, ativo.qtde, 1)}><Add fontSize="small" /></IconButton>
                          </Box>
                        </TableCell>
                        <TableCell align="right">R$ {Number(ativo.valor_unit).toFixed(2)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>R$ {(Number(ativo.valor_unit) * Number(ativo.qtde)).toFixed(2)}</TableCell>
                        <TableCell align="center">
                         <IconButton 
                        size="small" 
                        color="error" 
                        disabled={remaining <= 0 && totalPaid > 0}
                        onClick={() => setItemToDelete({ codp: ativo.codp, nome: ativo.nome })}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>

          <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 3 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, fontSize: '1.1rem' }}>Resumo</Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Card elevation={0} sx={{ border: 1, borderColor: 'divider', bgcolor: 'background.default' }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Typography variant="body2" color="text.secondary" fontWeight={500}>Valor Total</Typography>
                    <Typography variant="h6" fontWeight={700}>R$ {total.toFixed(2)}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Card elevation={0} sx={{ border: 1, borderColor: 'divider', bgcolor: 'background.default' }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Typography variant="body2" color="text.secondary" fontWeight={500}>Já Pago</Typography>
                    <Typography variant="h6" color="success.main" fontWeight={700}>R$ {totalPaid.toFixed(2)}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Card elevation={0} sx={{ border: 1, borderColor: 'divider', bgcolor: 'background.default' }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Typography variant="body2" color="text.secondary" fontWeight={500}>Restante</Typography>
                    <Typography variant="h6" color={remaining > 0 ? 'warning.main' : 'success.main'} fontWeight={700}>
                      R$ {remaining.toFixed(2)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Button
            variant="contained"
            disableElevation
            startIcon={<Payment />}
            onClick={() => setOpenPayment(true)}
            disabled={order.itens.length === 0}
            sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}
          >
            Pagar
          </Button>
        </DialogActions>
      </Dialog>

      {openPayment && (
        <PaymentDialog 
          orderId={orderId} 
          onClose={() => setOpenPayment(false)} 
          onOrderClosed={onClose} 
        />
      )}

      <Dialog 
        open={!!ativoToDelete} 
        onClose={() => setItemToDelete(null)} 
        PaperProps={{ sx: { borderRadius: '12px', p: 1, minWidth: '300px' } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          Remover Item?
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            Deseja realmente remover <strong>{ativoToDelete?.nome}</strong> da comanda? O produto será devolvido ao estoque.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setItemToDelete(null)} sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'none' }}>
            Cancelar
          </Button>
          <Button 
            onClick={executeRemoveItem} 
            variant="contained" 
            color="error"
            disableElevation
            sx={{ fontWeight: 600, textTransform: 'none' }}
          >
            Remover
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}