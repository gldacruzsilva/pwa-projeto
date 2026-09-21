import { useState, useRef, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box,
  Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, IconButton, TextField, Tabs, Tab,
  Grid, Card, CardContent, Chip, Autocomplete, Alert,
  useMediaQuery, useTheme
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
  lote: string; 
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
  
  const [ativoToDelete, setItemToDelete] = useState<{ codp: number, nome: string, lote: string } | null>(null);

  // 🟢 ESTADO NOVO: Memória cronológica de inserção dos itens
  const [itemHistory, setItemHistory] = useState<string[]>([]);

  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const fetchData = async () => {
    try {
      const [resOrder, resProducts] = await Promise.all([
        fetch(`/api/comandas/${orderId}`),
        fetch(`/api/produtos`)
      ]);

      if (resOrder.ok) setOrder(await resOrder.json());

      if (resProducts.ok) {
        const data = await resProducts.json();
        setProducts(Array.isArray(data) ? data : data.produtos || data.data || []);
      }

    } catch (error) {
      toast.error('Erro ao carregar os dados da comanda.');
    }
  };

  useEffect(() => {
    fetchData();
  }, [orderId]);

  // 🟢 LÓGICA DE ORDENAÇÃO FIXA E NUMERAÇÃO
  useEffect(() => {
    if (order?.itens) {
      setItemHistory(prev => {
        const currentKeys = order.itens.map(i => `${i.codp}-${i.lote}`);
        // Mantém a ordem dos que já estavam na lista
        const filteredPrev = prev.filter(key => currentKeys.includes(key));
        // Descobre os itens novos recém-chegados
        const novos = currentKeys.filter(key => !filteredPrev.includes(key));
        
        // Se nada mudou, devolve a mesma lista para não piscar a tela
        if (novos.length === 0 && filteredPrev.length === prev.length) return prev;
        
        // Os itens novos entram sempre no final (ganhando a numeração mais alta)
        return [...filteredPrev, ...novos];
      });
    }
  }, [order]);

  useEffect(() => {
    if (addMode === 'barcode' && barcodeInputRef.current && !isMobile) {
      barcodeInputRef.current.focus();
    }
  }, [addMode, isMobile]);

  const blockInvalidInteger = (e: React.KeyboardEvent) => {
    if (['-', '+', 'e', 'E', '.', ','].includes(e.key)) e.preventDefault();
  };

  if (!order) return null;

  const nomeCliente = order.Nick || order.nick || 'Sem nome';
  const codigoComanda = order.codv || order.codc || orderId;
  const popularProducts = [...products].slice(0, 6);

  const handleAddItem = async (codp: number, qtde: number, nome: string, lote: string) => {
    try {
      const response = await fetch(`/api/comandas/${orderId}/itens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codp, qtde, lote })
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

  const handleUpdateQuantity = async (codp: number, lote: string, currentQty: number | string, delta: number) => {
    const newQty = Number(currentQty) + delta;
    if (newQty <= 0) return;

    try {
      const response = await fetch(`/api/comandas/${orderId}/itens/${codp}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qtde: newQty, lote }) 
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
      const response = await fetch(`/api/comandas/${orderId}/itens/${ativoToDelete.codp}?lote=${ativoToDelete.lote}`, { method: 'DELETE' });
      
      if (response.ok) {
        toast.success('Produto removido e devolvido ao estoque.');
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
    if (!barcode.trim()) return toast.error('Digite um código de barras');

    const product = products.find(p => p.codp.toString() === barcode.trim());
    if (!product) {
      toast.error('Produto não encontrado');
      setBarcode('');
      return;
    }

    const qty = parseInt(quantity);
    if (qty > 0) handleAddItem(product.codp, qty, product.nome, product.lote || '1');
    
    setBarcode('');
    setQuantity('1');
    if (!isMobile) barcodeInputRef.current?.focus();
  };

  const handleSearchAdd = () => {
    if (!selectedProduct) return toast.error('Selecione um produto');
    
    const qty = parseInt(quantity);
    
    if (qty > 0) {
      handleAddItem(selectedProduct.codp, qty, selectedProduct.nome, selectedProduct.lote || '1');
      setSelectedProduct(null);
      setQuantity('1');
    }
  };

  const total = Number(order.valor_total) || 0;
  const totalPaid = Number((order as any).totalPaid) || 0; 
  const remaining = total - totalPaid;

  // 🟢 AQUI ACONTECE A MÁGICA VISUAL: Atribui o número e vira a lista de cabeça para baixo!
  const itensOrdenados = [...itemHistory]
    .map((key, index) => {
      const item = order.itens.find(i => `${i.codp}-${i.lote}` === key);
      if (!item) return null;
      return { ...item, numeroSequencia: index + 1 }; // O mais antigo ganha 1, o próximo ganha 2...
    })
    .filter((item): item is (ItemComanda & { numeroSequencia: number }) => item !== null)
    .reverse(); // Ao inverter, o número maior (mais recente) vai para o topo da lista.

  return (
    <>
      <Dialog open onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: '12px', bgcolor: 'background.paper', margin: isMobile ? 2 : 4 } }}>
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

        <DialogContent sx={{ p: { xs: 2, sm: 3 }, pt: { xs: 2, sm: 3 } }}>
          
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, fontSize: '1.1rem' }}>Lançar Produtos</Typography>

            <Tabs 
              value={addMode} 
              onChange={(_, v) => setAddMode(v)} 
              variant="scrollable"
              scrollButtons="auto"
              allowScrollButtonsMobile
              sx={{ mb: 3, minHeight: '40px', '& .MuiTab-root': { minHeight: '40px', textTransform: 'none', fontWeight: 500, px: { xs: 1, sm: 2 } } }}
            >
              <Tab icon={<QrCodeScanner sx={{ fontSize: 20 }} />} iconPosition="start" label="Código" value="barcode" />
              <Tab icon={<Add sx={{ fontSize: 20 }} />} iconPosition="start" label="Pesquisar" value="search" />
              <Tab icon={<TrendingUp sx={{ fontSize: 20 }} />} iconPosition="start" label="Sugestões" value="popular" />
            </Tabs>

            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, alignItems: { xs: 'stretch', sm: 'flex-start' } }}>
              <TextField
                label="Quantidade"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                onKeyDown={blockInvalidInteger}
                inputProps={{ min: 1, inputMode: 'numeric' }}
                size="small"
                sx={{ width: { xs: '100%', sm: '100px' } }}
              />

              <Box sx={{ flexGrow: 1 }}>
                {addMode === 'barcode' && (
                  <form onSubmit={handleBarcodeSubmit} style={{ display: 'flex', gap: '8px', flexDirection: isMobile ? 'column' : 'row' }}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Código de Barras"
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                      inputRef={barcodeInputRef}
                      placeholder="Escaneie o produto..."
                    />
                    <Button type="submit" variant="contained" disableElevation fullWidth={isMobile}>Inserir</Button>
                  </form>
                )}

                {addMode === 'search' && (
                  <Box display="flex" gap={1} flexDirection={{ xs: 'column', sm: 'row' }}>
                    <Autocomplete
                      fullWidth
                      size="small"
                      options={products}
                      isOptionEqualToValue={(option, value) => option.codp === value.codp && option.lote === value.lote}
                      getOptionLabel={(option) => 
                        `${option.nome ?? 'Sem nome'} - R$ ${Number(option.preco_venda || 0).toFixed(2)} (Est: ${option.qtde_estoque ?? 0})`
                      }
                      renderInput={(params) => <TextField {...params} label="Buscar pelo nome..." variant="outlined" />}
                      value={selectedProduct}
                      onChange={(_, newValue) => setSelectedProduct(newValue)}
                    />
                    <Button variant="contained" disableElevation onClick={handleSearchAdd} fullWidth={isMobile}>Inserir</Button>
                  </Box>
                )}

                {addMode === 'popular' && (
                  <Grid container spacing={1}>
                    {popularProducts.map((product) => (
                      <Grid size={{ xs: 6, sm: 4 }} key={`${product.codp}-${product.lote}`}>
                        <Card 
                          elevation={0}
                          sx={{ 
                            border: 1, 
                            borderColor: 'divider', 
                            cursor: 'pointer', 
                            bgcolor: 'background.default',
                            height: '100%',
                            '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' } 
                          }}
                          onClick={() => handleAddItem(product.codp, parseInt(quantity) || 1, product.nome, product.lote || '1')}
                        >
                          <CardContent sx={{ p: 1, '&:last-child': { pb: 1 }, textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
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
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, fontSize: '1.1rem' }}>Itens na Comanda</Typography>

            {itensOrdenados.length === 0 ? (
              <Alert severity="info" sx={{ mb: 4, borderRadius: '8px' }}>
                Nenhum ativo adicionado ainda. Use as opções acima para lançar produtos.
              </Alert>
            ) : (
              <>
                {isMobile ? (
                  <Box display="flex" flexDirection="column" gap={2} mb={2}>
                    {/* 🟢 O MAP AGORA USA A LISTA ORDENADA E FIXA */}
                    {itensOrdenados.map((ativo) => {
                      const valorTotalDesteItem = Number(ativo.valor_unit) * Number(ativo.qtde);
                      // TRAVA MATEMÁTICA PROTEGIDA
                      const bloqueiaDiminuir = Number(ativo.qtde) <= 1 || (total - Number(ativo.valor_unit)) < totalPaid;
                      const bloqueiaRemover = (total - valorTotalDesteItem) < totalPaid;

                      return (
                        <Card variant="outlined" key={`${ativo.codp}-${ativo.lote}`}>
                          <CardContent sx={{ pb: '16px !important', p: 2 }}>
                            <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
                              
                              {/* 🟢 VISUAL DO NÚMERO NO CELULAR */}
                              <Box display="flex" alignItems="center" gap={1.5}>
                                <Box sx={{ width: 26, height: 26, borderRadius: '50%', bgcolor: 'primary.main', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                  {ativo.numeroSequencia}
                                </Box>
                                <Typography variant="subtitle1" fontWeight="bold" lineHeight={1.2}>
                                  {ativo.nome}
                                </Typography>
                              </Box>

                              <IconButton 
                                size="small" 
                                color="error" 
                                disabled={bloqueiaRemover}
                                onClick={() => setItemToDelete({ codp: ativo.codp, nome: ativo.nome, lote: ativo.lote })}
                                sx={{ mt: -0.5, mr: -0.5 }}
                              >
                                <Delete fontSize="small" />
                              </IconButton>
                            </Box>
                            <Box display="flex" justifyContent="space-between" alignItems="center">
                              <Box display="flex" alignItems="center" gap={1}>
                                <IconButton 
                                  size="small" 
                                  sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}
                                  onClick={() => handleUpdateQuantity(ativo.codp, ativo.lote, ativo.qtde, -1)} 
                                  disabled={bloqueiaDiminuir}
                                >
                                  <Remove fontSize="small" />
                                </IconButton>
                                <Typography sx={{ minWidth: '24px', textAlign: 'center', fontWeight: 600 }}>{Number(ativo.qtde)}</Typography>
                                <IconButton 
                                  size="small" 
                                  sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}
                                  onClick={() => handleUpdateQuantity(ativo.codp, ativo.lote, ativo.qtde, 1)}
                                >
                                  <Add fontSize="small" />
                                </IconButton>
                              </Box>
                              <Box textAlign="right">
                                <Typography variant="caption" color="text.secondary" display="block">Subtotal</Typography>
                                <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                                  R$ {valorTotalDesteItem.toFixed(2)}
                                </Typography>
                              </Box>
                            </Box>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </Box>
                ) : (
                  <TableContainer sx={{ mb: 4, border: 1, borderColor: 'divider', borderRadius: '8px' }}>
                    <Table size="small">
                      <TableHead sx={{ bgcolor: 'action.hover' }}>
                        <TableRow>
                          {/* 🟢 COLUNA DO NÚMERO NO PC */}
                          <TableCell align="center" sx={{ fontWeight: 600, width: 40 }}>#</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Produto</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 600 }}>Qtd</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>Preço Unit.</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>Subtotal</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 600 }}>Remover</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {itensOrdenados.map((ativo) => {
                          const valorTotalDesteItem = Number(ativo.valor_unit) * Number(ativo.qtde);
                          const bloqueiaDiminuir = Number(ativo.qtde) <= 1 || (total - Number(ativo.valor_unit)) < totalPaid;
                          const bloqueiaRemover = (total - valorTotalDesteItem) < totalPaid;

                          return (
                            <TableRow key={`${ativo.codp}-${ativo.lote}`}>
                              
                              {/* 🟢 VISUAL DO NÚMERO NO PC */}
                              <TableCell align="center">
                                <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: 'primary.main', color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                  {ativo.numeroSequencia}
                                </Box>
                              </TableCell>
                              
                              <TableCell>{ativo.nome}</TableCell>
                              <TableCell align="center">
                                <Box display="flex" alignItems="center" justifyContent="center" gap={1}>
                                  <IconButton 
                                    size="small" 
                                    onClick={() => handleUpdateQuantity(ativo.codp, ativo.lote, ativo.qtde, -1)} 
                                    disabled={bloqueiaDiminuir}
                                  >
                                    <Remove fontSize="small" />
                                  </IconButton>
                                  <Typography sx={{ minWidth: '24px', textAlign: 'center', fontWeight: 500 }}>{Number(ativo.qtde)}</Typography>
                                  <IconButton 
                                    size="small" 
                                    onClick={() => handleUpdateQuantity(ativo.codp, ativo.lote, ativo.qtde, 1)}
                                  >
                                    <Add fontSize="small" />
                                  </IconButton>
                                </Box>
                              </TableCell>
                              <TableCell align="right">R$ {Number(ativo.valor_unit).toFixed(2)}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600 }}>R$ {valorTotalDesteItem.toFixed(2)}</TableCell>
                              <TableCell align="center">
                              <IconButton 
                                size="small" 
                                color="error" 
                                disabled={bloqueiaRemover}
                                onClick={() => setItemToDelete({ codp: ativo.codp, nome: ativo.nome, lote: ativo.lote })}
                              >
                                <Delete fontSize="small" />
                              </IconButton>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </>
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
            fullWidth={isMobile}
            sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, py: isMobile ? 1.5 : 1 }}
          >
            Pagar Comanda
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
        PaperProps={{ sx: { borderRadius: '12px', p: 1, minWidth: '300px', margin: 2 } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          Remover Produto?
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            Deseja realmente remover <strong>todas as unidades de {ativoToDelete?.nome}</strong> da comanda? 
            <br/><br/>
            Os produtos retornarão integralmente ao estoque.
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
            Remover Produto
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}