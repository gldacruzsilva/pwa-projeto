import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box,
  Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, IconButton, TextField,
  Grid, Card, CardContent, Autocomplete, Avatar, Tooltip, DialogContentText,
  InputAdornment, useMediaQuery, useTheme
} from '@mui/material';
import { Close, Add, Remove, Delete, Payment, Inventory2, HelpOutline, QrCodeScanner } from '@mui/icons-material';
import { toast } from 'sonner';
import PaymentDialog from './PaymentDialog';

interface OrderDetailDialogProps {
  orderId: number;
  onClose: () => void;
  onRegisterProduct: (barcode: string) => void;
}

interface ProdutoBanco {
  codp: number | string;
  nome: string;
  preco_custo?: number;
  preco_venda?: number;
  qtde_estoque: number;
  lote?: string;
  imagem?: string | null;
}

interface ItemComanda {
  codp: number | string;
  nome: string;
  qtde: number | string;
  valor_unit: string;
  lote: string; 
}

interface ComandaDetalhada {
  codv?: number;
  codc?: number;
  numero_exibicao?: number;
  Nick?: string;
  nick?: string;
  data_venda: string;
  valor_total: string;
  itens: ItemComanda[];
}

export default function OrderDetailDialog({ orderId, onClose, onRegisterProduct }: OrderDetailDialogProps) {
  const [order, setOrder] = useState<ComandaDetalhada | null>(null);
  const [products, setProducts] = useState<ProdutoBanco[]>([]);
  const [bestSellingProducts, setBestSellingProducts] = useState<ProdutoBanco[]>([]);
  
  const [quantity, setQuantity] = useState('1');
  const [productSearch, setProductSearch] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  const [barcodeToRegister, setBarcodeToRegister] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<ProdutoBanco | null>(null);
  const [openPayment, setOpenPayment] = useState(false);
  
  const [ativoToDelete, setItemToDelete] = useState<{ codp: number | string, nome: string, lote: string } | null>(null);

  const [itemHistory, setItemHistory] = useState<string[]>([]);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const fetchData = async () => {
    try {
      const [resOrder, resProducts, resBestSellingProducts] = await Promise.all([
        fetch(`/api/comandas/${orderId}`),
        fetch(`/api/produtos`),
        fetch(`/api/produtos/mais-vendidos`)
      ]);

      if (resOrder.ok) setOrder(await resOrder.json());

      if (resProducts.ok) {
        const data = await resProducts.json();
        setProducts(Array.isArray(data) ? data : data.produtos || data.data || []);
      }

      if (resBestSellingProducts.ok) {
        const data = await resBestSellingProducts.json();
        setBestSellingProducts(Array.isArray(data) ? data : data.produtos || data.data || []);
      } else {
        toast.error('Erro ao carregar os produtos mais vendidos.');
      }

    } catch (error) {
      toast.error('Erro ao carregar os dados da comanda.');
    }
  };

  useEffect(() => {
    fetchData();
  }, [orderId]);

  useEffect(() => {
    if (order?.itens) {
      setItemHistory(prev => {
        const currentKeys = order.itens.map(i => `${i.codp}-${i.lote}`);
        const filteredPrev = prev.filter(key => currentKeys.includes(key));
        const novos = currentKeys.filter(key => !filteredPrev.includes(key));
        
        if (novos.length === 0 && filteredPrev.length === prev.length) return prev;
        return [...filteredPrev, ...novos];
      });
    }
  }, [order]);

  const blockInvalidInteger = (e: React.KeyboardEvent) => {
    if (['-', '+', 'e', 'E', '.', ','].includes(e.key)) e.preventDefault();
  };

  if (!order) return null;

  const nomeCliente = order.Nick || order.nick || 'Sem nome';
  const codigoComanda = order.numero_exibicao ?? order.codv ?? order.codc ?? orderId;
  
  const handleAddItem = async (codp: number | string, qtde: number, nome: string, lote: string) => {
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

  const handleUpdateQuantity = async (codp: number | string, lote: string, currentQty: number | string, delta: number) => {
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

  const handleSearchAdd = () => {
    const quantidade = Number(quantity);
    if (!Number.isInteger(quantidade) || quantidade <= 0) return toast.error('Informe uma quantidade válida.');

    const codigo = productSearch.trim();
    const product = selectedProduct || products.find((item) => String(item.codp) === codigo);

    if (!product) {
      if (/^\d+$/.test(codigo)) {
        setBarcodeToRegister(codigo);
        return;
      }
      return toast.error('Selecione um produto da lista ou informe um código de barras válido.');
    }

    handleAddItem(product.codp, quantidade, product.nome, product.lote || '1');
    setSelectedProduct(null);
    setProductSearch('');
    setQuantity('1');
  };

  const total = Number(order.valor_total) || 0;
  const totalPaid = Number((order as any).totalPaid) || 0; 
  const remaining = total - totalPaid;
  const bloqueiaRemocaoPorPagamento = (valorRemovido: number) =>
    Math.round((total - valorRemovido) * 100) < Math.round(totalPaid * 100);

  const itensOrdenados = [...itemHistory]
    .map((key, index) => {
      const item = order.itens.find(i => `${i.codp}-${i.lote}` === key);
      if (!item) return null;
      return { ...item, numeroSequencia: index + 1 };
    })
    .filter((item): item is (ItemComanda & { numeroSequencia: number }) => item !== null)
    .reverse();

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
                size="small"
                onClick={onClose} 
                sx={{ 
                  color: '#ef4444', 
                  bgcolor: 'rgba(239, 68, 68, 0.15)', 
                  p: 0.5,
                  '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.25)' } 
                }}
              >
                <Close fontSize="small" />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: { xs: 2, sm: 3 }, pt: { xs: 2, sm: 3 } }}>
          
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, fontSize: '1.1rem' }}>Lançar Produtos</Typography>

            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1, mb: 2 }}>
              <TextField
                label="Qtd"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                onKeyDown={blockInvalidInteger}
                inputProps={{ min: 1, inputMode: 'numeric' }}
                size="small"
                sx={{ width: { xs: '100%', sm: '80px' } }}
              />

              <Autocomplete
                fullWidth
                size="small"
                options={products}
                filterOptions={(options, { inputValue }) => {
                  const search = inputValue.trim().toLocaleLowerCase('pt-BR');
                  if (!search) return options;
                  return options.filter((product) =>
                    String(product.nome || '').toLocaleLowerCase('pt-BR').includes(search)
                    || String(product.codp).includes(search)
                  );
                }}
                isOptionEqualToValue={(option, value) => option.codp === value.codp && option.lote === value.lote}
                getOptionLabel={(option) => 
                  `${option.nome ?? 'Sem nome'} R$ ${Number(option.preco_venda || 0).toFixed(2)} (Est: ${option.qtde_estoque ?? 0})`
                }
                renderOption={(props, product) => (
                  <Box component="li" {...props} key={`${product.codp}-${product.lote}`}>
                    <Avatar
                      src={product.imagem || undefined}
                      variant="rounded"
                      sx={{ width: 32, height: 32, mr: 1.5, bgcolor: 'action.hover' }}
                    >
                      <Inventory2 fontSize="small" />
                    </Avatar>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={600} noWrap>{product.nome || 'Sem nome'}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        R$ {Number(product.preco_venda || 0).toFixed(2)} · Estoque: {product.qtde_estoque ?? 0}
                      </Typography>
                    </Box>
                  </Box>
                )}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Pesquisar produto por nome ou código de barras"
                    variant="outlined"
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        handleSearchAdd();
                      }
                    }}
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: (
                        <>
                          <InputAdornment position="start"><QrCodeScanner /></InputAdornment>
                          {params.InputProps.startAdornment}
                        </>
                      ),
                    }}
                  />
                )}
                value={selectedProduct}
                inputValue={productSearch}
                onInputChange={(_, value, reason) => {
                  setProductSearch(value);
                  if (reason === 'input') setSelectedProduct(null);
                }}
                onChange={(_, newValue) => setSelectedProduct(newValue)}
              />
              <Button variant="contained" disableElevation onClick={handleSearchAdd} sx={{ minWidth: '100px' }} fullWidth={isMobile}>
                Inserir
              </Button>
            </Box>

            <Box sx={{ maxHeight: 150, overflowY: 'auto', pr: 1, pb: 1 }}>
              <Grid container spacing={1}>
                {bestSellingProducts.map((product) => (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }} key={`${product.codp}-${product.lote}`}>
                    <Card 
                      elevation={0}
                      sx={{ 
                        border: 1, 
                        borderColor: 'divider', 
                        cursor: 'pointer', 
                        bgcolor: 'background.default',
                        transition: 'all 0.1s',
                        '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover', transform: 'scale(0.98)' },
                        '&:active': { transform: 'scale(0.95)' }
                      }}
                      onClick={() => handleAddItem(product.codp, parseInt(quantity) || 1, product.nome, product.lote || '1')}
                    >
                      <CardContent sx={{ p: '8px !important', display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar
                          src={product.imagem || undefined}
                          variant="rounded"
                          sx={{ width: 32, height: 32, bgcolor: 'action.hover' }}
                        >
                          <Inventory2 sx={{ fontSize: 18 }} />
                        </Avatar>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {product.nome}
                          </Typography>
                          <Box display="flex" gap={1} alignItems="center">
                            <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'primary.main', lineHeight: 1 }}>
                              R$ {Number(product.preco_venda || 0).toFixed(2)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', lineHeight: 1 }}>
                              Est: {product.qtde_estoque}
                            </Typography>
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          </Box>

          <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 2, mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, fontSize: '1.1rem' }}>Itens na Comanda</Typography>

            {itensOrdenados.length > 0 && (
              <>
                {isMobile ? (
                  <Box display="flex" flexDirection="column" gap={1.5} mb={1}>
                    {itensOrdenados.map((ativo) => {
                      const valorTotalDesteItem = Number(ativo.valor_unit) * Number(ativo.qtde);
                      const bloqueiaDiminuir = Number(ativo.qtde) <= 1 || bloqueiaRemocaoPorPagamento(Number(ativo.valor_unit));
                      const bloqueiaRemover = bloqueiaRemocaoPorPagamento(valorTotalDesteItem);

                      return (
                        <Card variant="outlined" key={`${ativo.codp}-${ativo.lote}`}>
                          <CardContent sx={{ pb: '16px !important', p: 1.5 }}>
                            <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
                              <Box display="flex" alignItems="center" gap={1.5}>
                                <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: 'primary.main', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                  {ativo.numeroSequencia}
                                </Box>
                                <Typography variant="subtitle2" fontWeight="bold" lineHeight={1.2}>
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
                  <TableContainer sx={{ mb: 2, border: 1, borderColor: 'divider', borderRadius: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell align="center" sx={{ fontWeight: 600, width: 40, bgcolor: 'action.hover' }}>#</TableCell>
                          <TableCell sx={{ fontWeight: 600, bgcolor: 'action.hover' }}>Produto</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 600, bgcolor: 'action.hover' }}>Qtd</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600, bgcolor: 'action.hover' }}>Preço Unit.</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600, bgcolor: 'action.hover' }}>Subtotal</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 600, bgcolor: 'action.hover' }}>Remover</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {itensOrdenados.map((ativo) => {
                          const valorTotalDesteItem = Number(ativo.valor_unit) * Number(ativo.qtde);
                          const bloqueiaDiminuir = Number(ativo.qtde) <= 1 || bloqueiaRemocaoPorPagamento(Number(ativo.valor_unit));
                          const bloqueiaRemover = bloqueiaRemocaoPorPagamento(valorTotalDesteItem);

                          return (
                            <TableRow key={`${ativo.codp}-${ativo.lote}`}>
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

          <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 2 }}>
            <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 600, fontSize: '1.1rem' }}>Resumo</Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Card elevation={0} sx={{ border: 1, borderColor: 'divider', bgcolor: 'background.default' }}>
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="body2" color="text.secondary" fontWeight={500}>Valor Total</Typography>
                    <Typography variant="h6" fontWeight={700}>R$ {total.toFixed(2)}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Card elevation={0} sx={{ border: 1, borderColor: 'divider', bgcolor: 'background.default' }}>
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="body2" color="text.secondary" fontWeight={500}>Já Pago</Typography>
                    <Typography variant="h6" color="success.main" fontWeight={700}>R$ {totalPaid.toFixed(2)}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Card elevation={0} sx={{ border: 1, borderColor: 'divider', bgcolor: 'background.default' }}>
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
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

        <DialogActions sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper', justifyContent: 'space-between' }}>
          <Tooltip title="Ajuste a quantidade e pesquise por um produto ou clique rapidamente em uma das sugestões para adicionar." arrow placement="top-start">
            <IconButton
              size="small"
              aria-label="Ajuda sobre o funcionamento da comanda"
              onClick={() => setHelpOpen(true)}
              sx={{ color: 'text.secondary' }}
            >
              <HelpOutline fontSize="small" />
            </IconButton>
          </Tooltip>

          <Button
            variant="contained"
            disableElevation
            startIcon={<Payment />}
            onClick={() => setOpenPayment(true)}
            disabled={order.itens.length === 0}
            fullWidth={isMobile}
            sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, py: isMobile ? 1.5 : 1, width: isMobile ? '100%' : 'auto' }}
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

      <Dialog open={helpOpen} onClose={() => setHelpOpen(false)}>
        <DialogTitle>Como usar a comanda</DialogTitle>
        <DialogContent>
          <DialogContentText style={{ whiteSpace: 'pre-line' }}>
            Para lançar um produto na comanda, pesquise pelo nome, informe a quantidade e depois clique em inserir.
            <br />
            É possível adicionar itens por leitor de código de barras, caso ele não exista, o sistema abre a tela de cadastro com o código já inserido.
            <br />
            Se preferir, selecione algum produto da seleção. 
            <br />
            A seleção rápida mostra os seis produtos mais vendidos. 
            <br />
            Depois de adicionado, aumente ou diminua as quantidades com os botões de "+" e "-". 
            <br />
            Para remover um item clique na lixeira ao lado do produto inserido. 
            <br />
            O resumo mostra o valor total da comanda, o valor ainda a ser pago e o restante. 
            <br />
            A comanda permanecerá aberta caso seja clicado no ícone de X. 
            <br />
            Para fechar a comanda por completo é necessário pagar.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHelpOpen(false)}>Entendi</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(barcodeToRegister)} onClose={() => setBarcodeToRegister('')}>
        <DialogTitle>Produto não encontrado</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Não existe produto cadastrado com o código de barras {barcodeToRegister}. Deseja cadastrar?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBarcodeToRegister('')}>Não</Button>
          <Button
            variant="contained"
            onClick={() => {
              const codigo = barcodeToRegister;
              setBarcodeToRegister('');
              onRegisterProduct(codigo);
            }}
          >
            Sim, cadastrar
          </Button>
        </DialogActions>
      </Dialog>

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