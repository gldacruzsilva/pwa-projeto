import { useState, useEffect } from 'react';
import { 
  Box, TextField, Button, Paper, Typography, Table, TableBody, TableCell, 
  TableContainer, TableHead, TableRow, IconButton, Alert, Autocomplete, 
  Dialog, DialogTitle, DialogContent, DialogActions, MenuItem,
  Card, CardContent, useMediaQuery, useTheme 
} from '@mui/material';
import { Add, Delete, AddCircleOutline } from '@mui/icons-material';
import { toast } from 'sonner';

export default function StockReceiptPage() {
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
    : { nome: 'admin', tipo: 'admin', codu: 1 };

  const buscarProdutos = async () => {
    try {
      const resposta = await fetch('/api/produtos');
      if (resposta.ok) {
        const dados = await resposta.json();
        setProductList(Array.isArray(dados) ? dados : dados.produtos || []);
      }
    } catch (erro) { toast.error('Erro de conexão.'); }
  };

  useEffect(() => { buscarProdutos(); }, []);

  // 🟢 BLOQUEADORES DE TECLADO (A blindagem mágica)
  const blockInvalidInteger = (e: React.KeyboardEvent) => {
    // Bloqueia símbolos matemáticos, letras e decimais em campos inteiros
    if (['-', '+', 'e', 'E', '.', ','].includes(e.key)) {
      e.preventDefault();
    }
  };

  const blockInvalidDecimal = (e: React.KeyboardEvent) => {
    // Bloqueia símbolos e letras, mas permite ponto e vírgula
    if (['-', '+', 'e', 'E'].includes(e.key)) {
      e.preventDefault();
    }
  };

  const handleCadastrarNovoProduto = async () => {
    if (!novoProduto.codp.trim() || !novoProduto.nome.trim()) return toast.error('Preencha os campos obrigatórios!');
    
    // Barreira de segurança final no modal
    if (Number(novoProduto.codp) <= 0) return toast.error('O Código não pode ser zero.');
    if (Number(novoProduto.lote) < 0) return toast.error('O Lote não pode ser negativo.');

    try {
      const resposta = await fetch('/api/produtos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codp: parseInt(novoProduto.codp), 
          nome: novoProduto.nome, 
          preco_venda: parseFloat(novoProduto.preco || '0'),
          preco_custo: parseFloat(novoProduto.preco_custo || '0'), 
          lote: novoProduto.lote || '1', 
          qtde_estoque: 0,
          descricao: 'ENTRADA: Cadastro de Novo Produto no Sistema', 
          codu: usuarioAtual.codu 
        })
      });
      if (resposta.ok) {
        toast.success('Produto cadastrado!');
        setModalOpen(false);
        setNovoProduto({ codp: '', nome: '', preco: '', preco_custo: '', lote: '1' });
        buscarProdutos();
      } else { toast.error('Falha ou Lote duplicado.'); }
    } catch (erro) { toast.error('Erro de conexão ao cadastrar.'); }
  };

  const adicionarNaTabela = (product: any, qty: number, tipo: 'entrada' | 'saida') => {
    const existing = receiptItems.find(item => item.productCode === product.codp.toString() && item.originalBatch === (product.lote || '1'));
    if (existing) {
      setReceiptItems(receiptItems.map(item => 
        item.productCode === product.codp.toString() && item.originalBatch === (product.lote || '1') 
          ? { ...item, quantity: String(Number(item.quantity) + qty) } 
          : item
      ));
    } else {
      setReceiptItems([...receiptItems, {
        productCode: product.codp.toString(), 
        productName: product.nome, 
        preco_venda: String(product.preco_venda || 0),
        quantity: String(qty), 
        currentStock: product.qtde_estoque, 
        tipoMovimento: tipo,
        costPrice: String(product.preco_custo || 0), 
        batch: String(product.lote || '1'),
        originalCostPrice: Number(product.preco_custo || 0), 
        originalBatch: String(product.lote || '1'),
      }]);
    }
  };

  // 🟢 Funções de atualização do estado da tabela
  const handleDecimalChange = (index: number, field: 'preco_venda' | 'costPrice', val: string) => {
    if (Number(val) < 0) return; // Barreira extra contra copy-paste negativo
    const newItems = [...receiptItems];
    newItems[index][field] = val;
    setReceiptItems(newItems);
  };

  const handleIntegerChange = (index: number, field: 'batch' | 'quantity', val: string) => {
    if (Number(val) < 0) return;
    const newItems = [...receiptItems];
    newItems[index][field] = val;
    setReceiptItems(newItems);
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
      toast.error('Produto não encontrado. Cadastre-o!');
      setBarcode('');
      setModalOpen(true);
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
    if (receiptItems.length === 0) return toast.error('Adicione produtos para movimentar');

    // 🟢 BARREIRA FINAL ANTES DE ENVIAR AO BANCO
    for (const item of receiptItems) {
      const qtyNum = Number(item.quantity);
      const custoNum = Number(item.costPrice);
      const precoNum = Number(item.preco_venda);
      const loteNum = Number(item.batch);

      if (isNaN(qtyNum) || qtyNum <= 0) return toast.error(`Atenção: A quantidade de "${item.productName}" deve ser MAIOR que zero!`);
      if (isNaN(loteNum) || loteNum < 0) return toast.error(`Atenção: Lote de "${item.productName}" inválido.`);
      if (isNaN(custoNum) || custoNum < 0) return toast.error(`Atenção: Custo de "${item.productName}" inválido.`);
      if (isNaN(precoNum) || precoNum < 0) return toast.error(`Atenção: Preço Comanda de "${item.productName}" inválido.`);

      const novoEstoque = item.currentStock + (item.tipoMovimento === 'entrada' ? qtyNum : -qtyNum);
      if (novoEstoque < 0) return toast.error(`Atenção: O estoque final de ${item.productName} não pode ficar negativo (${novoEstoque}).`);

      if (item.tipoMovimento === 'entrada') {
        const mudouCusto = custoNum !== item.originalCostPrice;
        const mudouLote = String(item.batch) !== String(item.originalBatch);
        if (mudouCusto && !mudouLote) return toast.error(`Atenção: Custo de "${item.productName}" mudou. Informe um NOVO LOTE.`);
        if (mudouLote && !mudouCusto) return toast.error(`Atenção: Lote de "${item.productName}" mudou. Avalie se o custo se mantém.`);
      }
    }

    try {
      const promessas = receiptItems.map(async (item) => {
        const criarNovoLote = item.tipoMovimento === 'entrada' && String(item.batch) !== String(item.originalBatch);
        const prefixo = item.tipoMovimento.toUpperCase();
        const textoDescricao = `${prefixo}: ${description.trim() || 'Movimentação de estoque'}`;
        const qtyNum = Number(item.quantity);
        const novoEstoque = item.currentStock + (item.tipoMovimento === 'entrada' ? qtyNum : -qtyNum);
        
        if (criarNovoLote) {
          return fetch('/api/produtos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              codp: parseInt(item.productCode), 
              nome: item.productName, 
              preco_venda: Number(item.preco_venda), 
              preco_custo: Number(item.costPrice), 
              lote: item.batch, 
              qtde_estoque: qtyNum,
              descricao: textoDescricao, 
              codu: usuarioAtual.codu 
            })
          });
        } else {
          return fetch(`api/produtos/${item.productCode}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              nome: item.productName, 
              preco_venda: Number(item.preco_venda), 
              qtde_estoque: novoEstoque,
              qtde_movimento: qtyNum,
              preco_custo: item.originalCostPrice, 
              lote: item.batch, 
              lote_original: item.originalBatch,
              descricao: textoDescricao, 
              codu: usuarioAtual.codu 
            })
          });
        }
      });
      await Promise.all(promessas);
      toast.success('Sucesso!');
      setDescription('');
      setReceiptItems([]);
      setTimeout(() => window.location.reload(), 1500);
    } catch (erro) { toast.error('Erro ao salvar no servidor.'); }
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
          Adicione os produtos abaixo e defina na tabela se deseja registrar uma entrada ou saída de estoque.
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
              {receiptItems.map((item, index) => {
                const qtyNum = Number(item.quantity) || 0;
                const novoEstoque = item.currentStock + (item.tipoMovimento === 'entrada' ? qtyNum : -qtyNum);
                return (
                  <Card key={`${item.productCode}-${item.originalBatch}-${index}`} variant="outlined">
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
                            onChange={(e) => {
                              const newArr = [...receiptItems];
                              newArr[index].tipoMovimento = e.target.value as 'entrada'|'saida';
                              setReceiptItems(newArr);
                            }}
                          >
                            <MenuItem value="entrada">Entrada</MenuItem>
                            <MenuItem value="saida">Saída</MenuItem>
                          </TextField>
                          <TextField 
                            fullWidth label="Lote" type="number" value={item.batch} size="small" disabled={item.tipoMovimento === 'saida'}
                            onChange={(e) => handleIntegerChange(index, 'batch', e.target.value)}
                            onKeyDown={blockInvalidInteger}
                            inputProps={{ min: 0, step: 1 }}
                          />
                        </Box>
                        
                        <Box display="flex" gap={2}>
                          <TextField 
                            fullWidth label="Custo (R$)" type="number" value={item.costPrice} size="small" disabled={item.tipoMovimento === 'saida'}
                            onChange={(e) => handleDecimalChange(index, 'costPrice', e.target.value)}
                            onKeyDown={blockInvalidDecimal}
                            inputProps={{ min: 0, step: 1 }}
                          />
                          <TextField 
                            fullWidth label="Venda (R$)" type="number" value={item.preco_venda} size="small"
                            onChange={(e) => handleDecimalChange(index, 'preco_venda', e.target.value)}
                            onKeyDown={blockInvalidDecimal}
                            inputProps={{ min: 0, step: 1 }}
                          />
                        </Box>

                        <Box display="flex" gap={2} alignItems="center">
                          <TextField 
                            fullWidth label="Quantidade" type="number" value={item.quantity} size="small"
                            onChange={(e) => handleIntegerChange(index, 'quantity', e.target.value)}
                            onKeyDown={blockInvalidInteger}
                            inputProps={{ min: 0, step: 1 }}
                          />
                          <Box sx={{ textAlign: 'center', width: '100%' }}>
                            <Typography variant="caption" color="text.secondary" display="block">Estoque Final</Typography>
                            <Typography variant="body1" fontWeight="bold" color={item.tipoMovimento === 'entrada' ? 'success.main' : 'error.main'}>
                              {novoEstoque}
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                );
              })}
            </Box>
          ) : (
            <TableContainer sx={{ mb: 4 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Produto</TableCell>
                    <TableCell>Tipo</TableCell>
                    <TableCell>Lote</TableCell>
                    <TableCell>Custo</TableCell>
                    <TableCell>Preço Comanda</TableCell>
                    <TableCell>Qtde</TableCell>
                    <TableCell align="right">Est. Final</TableCell>
                    <TableCell align="center">Ação</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {receiptItems.map((item, index) => {
                    const qtyNum = Number(item.quantity) || 0;
                    const novoEstoque = item.currentStock + (item.tipoMovimento === 'entrada' ? qtyNum : -qtyNum);
                    return (
                      <TableRow key={`${item.productCode}-${item.originalBatch}-${index}`}>
                        <TableCell>{item.productName}</TableCell>
                        <TableCell>
                          <TextField 
                            select value={item.tipoMovimento} size="small"
                            onChange={(e) => {
                              const newArr = [...receiptItems];
                              newArr[index].tipoMovimento = e.target.value as 'entrada'|'saida';
                              setReceiptItems(newArr);
                            }} 
                          >
                            <MenuItem value="entrada">Entrada</MenuItem>
                            <MenuItem value="saida">Saída</MenuItem>
                          </TextField>
                        </TableCell>
                        <TableCell>
                          <TextField 
                            type="number" value={item.batch} size="small" disabled={item.tipoMovimento === 'saida'} sx={{ width: 90 }}
                            onChange={(e) => handleIntegerChange(index, 'batch', e.target.value)} 
                            onKeyDown={blockInvalidInteger}
                            inputProps={{ min: 0, step: 1 }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField 
                            type="number" value={item.costPrice} size="small" disabled={item.tipoMovimento === 'saida'} sx={{ width: 110 }}
                            onChange={(e) => handleDecimalChange(index, 'costPrice', e.target.value)} 
                            onKeyDown={blockInvalidDecimal}
                            inputProps={{ min: 0, step: 1 }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField 
                            type="number" value={item.preco_venda} size="small" sx={{ width: 110 }}
                            onChange={(e) => handleDecimalChange(index, 'preco_venda', e.target.value)} 
                            onKeyDown={blockInvalidDecimal}
                            inputProps={{ min: 0, step: 1 }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField 
                            type="number" value={item.quantity} size="small" sx={{ width: 100 }}
                            onChange={(e) => handleIntegerChange(index, 'quantity', e.target.value)} 
                            onKeyDown={blockInvalidInteger}
                            inputProps={{ min: 0, step: 1 }}
                          />
                        </TableCell>
                        <TableCell align="right" className={`font-bold ${novoEstoque < 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {novoEstoque}
                        </TableCell>
                        <TableCell align="center">
                          <IconButton size="small" color="error" onClick={() => removerDaTabela(index)}>
                            <Delete />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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

      {/* 🟢 MODAL COM CAMPOS BLINDADOS */}
      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle>Cadastrar Novo Produto</DialogTitle>
        <DialogContent dividers>
          <Box display="flex" flexDirection="column" gap={3} mt={1}>
            <TextField 
              label="Código (Barras)" fullWidth type="number" value={novoProduto.codp} 
              onChange={(e) => { if (Number(e.target.value) >= 0) setNovoProduto({ ...novoProduto, codp: e.target.value }) }} 
              onKeyDown={blockInvalidInteger}
              inputProps={{ min: 1, step: 1 }} 
            />
            <TextField 
              label="Nome" fullWidth value={novoProduto.nome} 
              onChange={(e) => setNovoProduto({ ...novoProduto, nome: e.target.value })} 
            />
            <Box display="flex" gap={2}>
              <TextField 
                label="Lote Inicial" fullWidth type="number" value={novoProduto.lote} 
                onChange={(e) => { if (Number(e.target.value) >= 0) setNovoProduto({ ...novoProduto, lote: e.target.value }) }} 
                onKeyDown={blockInvalidInteger}
                inputProps={{ min: 0, step: 1 }} 
              />
              <TextField 
                label="Preço Custo (R$)" fullWidth type="number" value={novoProduto.preco_custo} 
                onChange={(e) => { if (Number(e.target.value) >= 0) setNovoProduto({ ...novoProduto, preco_custo: e.target.value }) }} 
                onKeyDown={blockInvalidDecimal}
                inputProps={{ min: 0, step: 1 }} 
              />
            </Box>
            <TextField 
              label="Preço Comanda (R$)" fullWidth type="number" value={novoProduto.preco} 
              onChange={(e) => { if (Number(e.target.value) >= 0) setNovoProduto({ ...novoProduto, preco: e.target.value }) }} 
              onKeyDown={blockInvalidDecimal}
              inputProps={{ min: 0, step: 1 }} 
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