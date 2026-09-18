import { useState, useEffect } from 'react';
import { 
  Box, TextField, Button, Paper, Typography, Table, TableBody, TableCell, 
  TableContainer, TableHead, TableRow, IconButton, Alert, Autocomplete, 
  Dialog, DialogTitle, DialogContent, DialogActions, MenuItem,
  Card, CardContent, useMediaQuery, useTheme 
} from '@mui/material';
import { Add, Remove, Delete, AddCircleOutline } from '@mui/icons-material';
import { toast } from 'sonner';

export default function StockReceiptTab() {
  const [description, setDescription] = useState('');
  const [receiptItems, setReceiptItems] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [barcode, setBarcode] = useState('');
  const [productList, setProductList] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [novoProduto, setNovoProduto] = useState({ codp: '', nome: '', preco: '', preco_custo: '', lote: '1' });

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const usuarioString = localStorage.getItem('usuarioAtivo');
  const usuarioAtual = usuarioString 
    ? JSON.parse(usuarioString) 
    : { nome: 'funcionario', tipo: 'funcionario', codu: 2 };

  const buscarProdutos = async () => {
    try {
      // 🟢 ROTA CORRIGIDA PARA FUNCIONAR NO CELULAR
      const resposta = await fetch('/api/produtos');
      if (resposta.ok) {
        const dados = await resposta.json();
        setProductList(Array.isArray(dados) ? dados : dados.produtos || []);
      }
    } catch (erro) { toast.error('Erro de conexão.'); }
  };

  useEffect(() => { buscarProdutos(); }, []);

  // 🟢 BLOQUEADORES DE TECLADO
  const blockInvalidInteger = (e: React.KeyboardEvent) => {
    if (['-', '+', 'e', 'E', '.', ','].includes(e.key)) e.preventDefault();
  };

  const blockInvalidDecimal = (e: React.KeyboardEvent) => {
    if (['-', '+', 'e', 'E'].includes(e.key)) e.preventDefault();
  };

  const handleCadastrarNovoProduto = async () => {
    if (!novoProduto.codp.trim() || !novoProduto.nome.trim()) return toast.error('Preencha os campos!');
    try {
      // 🟢 ROTA CORRIGIDA PARA FUNCIONAR NO CELULAR
      const resposta = await fetch('/api/produtos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codp: parseInt(novoProduto.codp), nome: novoProduto.nome, preco_venda: parseFloat(novoProduto.preco || '0'),
          preco_custo: parseFloat(novoProduto.preco_custo || '0'), lote: novoProduto.lote || '1', qtde_estoque: 0,
          descricao: 'ENTRADA: Cadastro de Novo Produto no Sistema', 
          codu: usuarioAtual.codu 
        })
      });
      if (resposta.ok) {
        toast.success('Produto cadastrado!');
        setModalOpen(false);
        setNovoProduto({ codp: '', nome: '', preco: '', preco_custo: '', lote: '1' });
        buscarProdutos();
      } else { toast.error('Falha ao cadastrar produto.'); }
    } catch (erro) { toast.error('Erro de conexão.'); }
  };

  const adicionarNaTabela = (product: any, qty: number, tipo: 'entrada' | 'saida') => {
    const existing = receiptItems.find(item => item.productCode === product.codp.toString() && item.batch === product.lote);
    if (existing) {
      setReceiptItems(receiptItems.map(item => item.productCode === product.codp.toString() && item.batch === product.lote ? { ...item, quantity: item.quantity + qty } : item));
    } else {
      setReceiptItems([...receiptItems, {
        productCode: product.codp.toString(), productName: product.nome, preco_venda: Number(product.preco_venda || 0),
        quantity: Math.max(0, qty), currentStock: product.qtde_estoque, tipoMovimento: tipo,
        costPrice: Number(product.preco_custo || 0), batch: product.lote || '1',
        originalCostPrice: Number(product.preco_custo || 0), originalBatch: product.lote || '1',
      }]);
    }
  };

  const removerDaTabela = (index: number) => {
    const novaLista = [...receiptItems];
    novaLista.splice(index, 1);
    setReceiptItems(novaLista);
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcode.trim()) return toast.error('Digite um código');
    const productsMatch = productList.filter(p => p.codp.toString() === barcode.trim());
    if (productsMatch.length === 0) {
      toast.error('Produto não encontrado. Solicite o cadastro!');
      setBarcode('');
      return;
    }
    adicionarNaTabela(productsMatch[productsMatch.length - 1], 1, 'entrada');
    setBarcode('');
  };

  const handleAddItem = () => {
    if (!selectedProduct) return toast.error('Selecione');
    const [cod, lote] = selectedProduct.split('|');
    const product = productList.find(p => p.codp.toString() === cod && p.lote === lote);
    if (product) adicionarNaTabela(product, 1, 'entrada');
    setSelectedProduct(null);
  };

  const handleSaveReceipt = async () => {
    if (receiptItems.length === 0) return toast.error('Adicione produtos');

    if (receiptItems.some(item => item.quantity <= 0)) {
      return toast.error('Verifique as quantidades. Valores zerados não são permitidos.');
    }

    try {
      const promessas = receiptItems.map(async (item) => {
        const prefixo = item.tipoMovimento.toUpperCase();
        const textoDescricao = `${prefixo}: ${description.trim() || 'Movimentação de estoque'}`;
        const novoEstoque = item.currentStock + (item.tipoMovimento === 'entrada' ? item.quantity : -item.quantity);
        
        if (novoEstoque < 0) {
          throw new Error(`Estoque insuficiente para a saída do produto: ${item.productName}`);
        }

        // 🟢 ROTA CORRIGIDA PARA FUNCIONAR NO CELULAR
        return fetch(`/api/produtos/${item.productCode}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nome: item.productName, preco_venda: item.preco_venda, qtde_estoque: novoEstoque,
            preco_custo: item.originalCostPrice, lote: item.originalBatch, lote_original: item.originalBatch,
            descricao: textoDescricao, 
            codu: usuarioAtual.codu 
          })
        });
      });
      await Promise.all(promessas);
      toast.success('Estoque atualizado com sucesso!');
      setDescription('');
      setReceiptItems([]);
      setTimeout(() => window.location.reload(), 1500);
    } catch (erro: any) { toast.error(erro.message || 'Erro ao salvar no banco.'); }
  };

  return (
    <Box>
       <Box display="flex" justifyContent="flex-start" alignItems="center" mb={4}>
        <Button variant="outlined" startIcon={<AddCircleOutline />} onClick={() => setModalOpen(true)}> 
          Cadastrar Novo Produto 
        </Button>
      </Box>

      <Paper sx={{ p: { xs: 2, sm: 4 }, mb: 4, borderRadius: 2 }}>
        <Alert severity="info" sx={{ mb: 4 }}>
          Adicione os produtos abaixo e ajuste a quantidade da movimentação.
        </Alert>

        <Typography variant="subtitle2" sx={{ mb: 2, color: 'text.secondary', fontWeight: 'bold' }}> Adicionar por Código </Typography>
        <form onSubmit={handleBarcodeSubmit}>
          <Box display="flex" gap={2} mb={4} flexDirection={{ xs: 'column', sm: 'row' }}>
            <TextField fullWidth label="Código do Produto" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
            <Button type="submit" variant="contained" startIcon={<Add />} sx={{ height: 56, minWidth: { sm: 160 }, flexShrink: 0 }} fullWidth={isMobile}> 
              Adicionar 
            </Button>
          </Box>
        </form>

        <Typography variant="subtitle2" sx={{ mb: 2, color: 'text.secondary', fontWeight: 'bold' }}> Adicionar por Pesquisa </Typography>
        <Box display="flex" gap={2} mb={2} flexDirection={{ xs: 'column', sm: 'row' }}>
          <Autocomplete
            fullWidth options={productList}
            getOptionLabel={(o) => `${o.nome} (Lote: ${o.lote || '1'} | Est: ${o.qtde_estoque})`}
            isOptionEqualToValue={(option, value) => option.codp === value.codp && option.lote === value.lote}
            renderInput={(params) => <TextField {...params} label="Buscar Produto pelo Nome ou Lote" variant="outlined" />}
            value={productList.find(p => p.codp.toString() === selectedProduct?.split('|')[0] && p.lote === selectedProduct?.split('|')[1]) || null}
            onChange={(_, nv) => setSelectedProduct(nv ? `${nv.codp}|${nv.lote}` : null)}
          />
          <Button variant="contained" onClick={handleAddItem} sx={{ height: 56, minWidth: { sm: 160 }, flexShrink: 0 }} fullWidth={isMobile}> 
            Adicionar 
          </Button>
        </Box>
      </Paper>

      {receiptItems.length > 0 && (
        <Paper sx={{ p: { xs: 2, sm: 4 } }}>
          
          {isMobile ? (
            <Box display="flex" flexDirection="column" gap={2} mb={4}>
              {receiptItems.map((item, index) => (
                <Card key={`${item.productCode}-${item.originalBatch}`} variant="outlined">
                  <CardContent sx={{ pb: '16px !important' }}>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                      <Typography variant="subtitle1" fontWeight="bold" lineHeight={1.2}>
                        {item.productName}
                      </Typography>
                      <IconButton size="small" color="error" onClick={() => removerDaTabela(index)}>
                        <Delete />
                      </IconButton>
                    </Box>
                    
                    <Box display="flex" flexDirection="column" gap={2}>
                      <Box display="flex" gap={2}>
                        <TextField 
                          select fullWidth label="Movimento" value={item.tipoMovimento} size="small"
                          onChange={(e) => setReceiptItems(receiptItems.map(i => i === item ? {...i, tipoMovimento: e.target.value} : i))}
                        >
                          <MenuItem value="entrada">Entrada</MenuItem>
                          <MenuItem value="saida">Saída</MenuItem>
                        </TextField>
                        <TextField fullWidth label="Lote" value={item.batch} size="small" disabled={true} />
                      </Box>
                      
                      <Box display="flex" gap={2}>
                        <TextField fullWidth label="Custo (R$)" type="number" value={item.costPrice} size="small" disabled={true} />
                        <TextField fullWidth label="Venda (R$)" type="number" value={item.preco_venda} size="small" disabled={true} />
                      </Box>

                      <Box display="flex" gap={1} alignItems="center">
                        <IconButton size="small" onClick={() => setReceiptItems(receiptItems.map(i => i === item ? {...i, quantity: Math.max(0, i.quantity - 1)} : i))}>
                          <Remove />
                        </IconButton>
                        <TextField 
                          fullWidth label="Quantidade" type="number" value={item.quantity} size="small"
                          onChange={(e) => setReceiptItems(receiptItems.map(i => i === item ? {...i, quantity: Math.max(0, Number(e.target.value))} : i))}
                          onKeyDown={blockInvalidInteger}
                          inputProps={{ min: 0, step: 1 }}
                        />
                        <IconButton size="small" onClick={() => setReceiptItems(receiptItems.map(i => i === item ? {...i, quantity: i.quantity + 1} : i))}>
                          <Add />
                        </IconButton>
                      </Box>

                      <Box sx={{ textAlign: 'center', width: '100%', mt: 1 }}>
                        <Typography variant="caption" color="text.secondary" display="block">Estoque Final</Typography>
                        <Typography variant="body1" fontWeight="bold" color={item.tipoMovimento === 'entrada' ? 'success.main' : 'error.main'}>
                          {item.currentStock + (item.tipoMovimento === 'entrada' ? item.quantity : -item.quantity)}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Box>
          ) : (
            <TableContainer sx={{ mb: 4 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Produto</TableCell><TableCell>Tipo</TableCell><TableCell>Lote</TableCell>
                    <TableCell>Custo</TableCell><TableCell>Preço Comanda</TableCell><TableCell align="center">Qtde</TableCell>
                    <TableCell>Est. Final</TableCell><TableCell align="center">Ação</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {receiptItems.map((item, index) => (
                    <TableRow key={`${item.productCode}-${item.originalBatch}`}>
                      <TableCell>{item.productName}</TableCell>
                      <TableCell>
                        <TextField select value={item.tipoMovimento} onChange={(e) => setReceiptItems(receiptItems.map(i => i === item ? {...i, tipoMovimento: e.target.value} : i))} size="small">
                          <MenuItem value="entrada">Entrada</MenuItem><MenuItem value="saida">Saída</MenuItem>
                        </TextField>
                      </TableCell>
                      
                      <TableCell><TextField value={item.batch} size="small" disabled={true} /></TableCell>
                      <TableCell><TextField type="number" value={item.costPrice} size="small" disabled={true} /></TableCell>
                      <TableCell><TextField type="number" value={item.preco_venda} size="small" disabled={true} /></TableCell>
                      
                      <TableCell align="center">
                        <Box display="flex" alignItems="center" gap={1} justifyContent="center">
                          <IconButton size="small" onClick={() => setReceiptItems(receiptItems.map(i => i === item ? {...i, quantity: Math.max(0, i.quantity - 1)} : i))}>
                            <Remove fontSize="small" />
                          </IconButton>
                          <TextField 
                            type="number" value={item.quantity} 
                            onChange={(e) => setReceiptItems(receiptItems.map(i => i === item ? {...i, quantity: Math.max(0, Number(e.target.value))} : i))} 
                            size="small" sx={{ width: 80 }} 
                            onKeyDown={blockInvalidInteger}
                            inputProps={{ min: 0, step: 1 }}
                          />
                          <IconButton size="small" onClick={() => setReceiptItems(receiptItems.map(i => i === item ? {...i, quantity: i.quantity + 1} : i))}>
                            <Add fontSize="small" />
                          </IconButton>
                        </Box>
                      </TableCell>

                      <TableCell className="font-bold">{item.currentStock + (item.tipoMovimento === 'entrada' ? item.quantity : -item.quantity)}</TableCell>
                      <TableCell align="center">
                        <IconButton size="small" color="error" onClick={() => removerDaTabela(index)}>
                          <Delete />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          <Box mb={4}>
            <TextField fullWidth label="Descrição da Movimentação (Opcional)" value={description} onChange={(e) => setDescription(e.target.value)} multiline rows={2} placeholder="Ex: Compra com Fornecedor X, Descarte de mercadoria vencida..." />
          </Box>
          <Button variant="contained" fullWidth onClick={handleSaveReceipt} sx={{ height: 48, fontWeight: 'bold' }}> 
            Finalizar Movimentação 
          </Button>
        </Paper>
      )}

      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle>Cadastrar Novo Produto</DialogTitle>
        <DialogContent dividers>
          <Box display="flex" flexDirection="column" gap={3} mt={1}>
            <TextField 
              label="Código (Barras)" fullWidth type="number" value={novoProduto.codp} 
              onChange={(e) => setNovoProduto({ ...novoProduto, codp: e.target.value })} 
              onKeyDown={blockInvalidInteger}
              inputProps={{ min: 0, step: 1 }}
            />
            <TextField label="Nome" fullWidth value={novoProduto.nome} onChange={(e) => setNovoProduto({ ...novoProduto, nome: e.target.value })} />
            <Box display="flex" gap={2}>
              <TextField 
                label="Lote Inicial" fullWidth type="number" value={novoProduto.lote} 
                onChange={(e) => setNovoProduto({ ...novoProduto, lote: e.target.value })} 
                onKeyDown={blockInvalidInteger}
                inputProps={{ min: 0, step: 1 }}
              />
              <TextField 
                label="Preço Custo" type="number" fullWidth value={novoProduto.preco_custo} 
                onChange={(e) => setNovoProduto({ ...novoProduto, preco_custo: e.target.value })} 
                onKeyDown={blockInvalidDecimal}
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Box>
            <TextField 
              label="Preço Comanda" type="number" fullWidth value={novoProduto.preco} 
              onChange={(e) => setNovoProduto({ ...novoProduto, preco: e.target.value })} 
              onKeyDown={blockInvalidDecimal}
              inputProps={{ min: 0, step: 0.01 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModalOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleCadastrarNovoProduto}>Salvar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}