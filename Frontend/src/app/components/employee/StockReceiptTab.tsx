import { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Autocomplete,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
} from '@mui/material';
import { Add, Delete, Save, AddCircleOutline } from '@mui/icons-material';
import { toast } from 'sonner';

interface ReceiptItem {
  productCode: string;
  productName: string;
  preco: number; 
  quantity: number | ''; 
  currentStock: number;
  tipoMovimento: 'entrada' | 'saida';
}

interface ProdutoDoBanco {
  codp: number;
  nome: string;
  preco: number;
  qtde_estoque: number;
}

export default function StockReceiptTab() {
  const [receiptItems, setReceiptItems] = useState<ReceiptItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [barcode, setBarcode] = useState('');
  
  const [productList, setProductList] = useState<ProdutoDoBanco[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [novoProduto, setNovoProduto] = useState({ codp: '', nome: '', preco: '' });

  const usuarioString = localStorage.getItem('usuarioAtivo');
  const usuarioAtual = usuarioString ? JSON.parse(usuarioString) : { codu: 1 };

  const buscarProdutos = async () => {
    try {
      const resposta = await fetch('/api/produtos'); 
      if (resposta.ok) {
        const dados = await resposta.json();
        setProductList(dados);
      }
    } catch (erro) {
      toast.error('Erro ao conectar com o servidor para buscar produtos.');
    }
  };

  useEffect(() => {
    buscarProdutos();
  }, []);

  const handleCadastrarNovoProduto = async () => {
    if (!novoProduto.codp.trim() || !novoProduto.nome.trim()) {
      toast.error('Preencha o código e o nome do produto!');
      return;
    }

    try {
      const resposta = await fetch('/api/produtos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codp: parseInt(novoProduto.codp, 10),
          nome: novoProduto.nome,
          preco: parseFloat(novoProduto.preco || '0'), 
          qtde_estoque: 0 
        })
      });

      if (resposta.ok) {
        toast.success('Produto cadastrado com sucesso!');
        setModalOpen(false);
        setNovoProduto({ codp: '', nome: '', preco: '' });
        buscarProdutos(); 
      } else {
        toast.error('Falha ao cadastrar o produto.');
      }
    } catch (erro) {
      toast.error('Erro de conexão ao cadastrar produto.');
    }
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcode.trim()) return toast.error('Digite um código de produto');
    
    const product = productList.find(p => p.codp.toString() === barcode.trim());
    if (!product) {
      toast.error('Produto não encontrado. Cadastre-o agora!');
      setBarcode('');
      setModalOpen(true);
      return;
    }
    adicionarNaTabela(product, 1);
    setBarcode('');
  };

  const handleAddItem = () => {
    if (!selectedProduct) return toast.error('Selecione um produto');
    const product = productList.find(p => p.codp.toString() === selectedProduct);
    if (!product) return;
    adicionarNaTabela(product, 1);
    setSelectedProduct(null);
  };

  const adicionarNaTabela = (product: ProdutoDoBanco, qty: number) => {
    if (qty <= 0) return toast.error('Quantidade deve ser maior que zero');
    const existingItem = receiptItems.find(item => item.productCode === product.codp.toString());
    
    if (existingItem) {
      setReceiptItems(receiptItems.map(item =>
        item.productCode === product.codp.toString() 
          ? { ...item, quantity: (typeof item.quantity === 'number' ? item.quantity : 0) + qty } 
          : item
      ));
    } else {
      setReceiptItems([...receiptItems, {
        productCode: product.codp.toString(),
        productName: product.nome,
        preco: Number(product.preco),
        quantity: qty,
        currentStock: product.qtde_estoque,
        tipoMovimento: 'entrada',
      }]);
    }
    toast.success('Produto adicionado ao recebimento');
  };

  const handleRemoveItem = (productCode: string) => {
    setReceiptItems(receiptItems.filter(item => item.productCode !== productCode));
  };

  const handleUpdateQuantity = (productCode: string, value: string) => {
    if (value === '') {
      setReceiptItems(receiptItems.map(item =>
        item.productCode === productCode ? { ...item, quantity: '' } : item
      ));
      return;
    }

    // Remove estritamente qualquer caractere que não seja número (bloqueia o sinal de menos)
    const cleanValue = value.replace(/\D/g, '');
    if (cleanValue === '') {
      setReceiptItems(receiptItems.map(item =>
        item.productCode === productCode ? { ...item, quantity: '' } : item
      ));
      return;
    }

    const num = parseInt(cleanValue, 10);
    setReceiptItems(receiptItems.map(item =>
      item.productCode === productCode ? { ...item, quantity: num > 0 ? num : '' } : item
    ));
  };

  const handleUpdateTipo = (productCode: string, tipo: 'entrada' | 'saida') => {
    setReceiptItems(receiptItems.map(item =>
      item.productCode === productCode ? { ...item, tipoMovimento: tipo } : item
    ));
  };

  const handleSaveReceipt = async () => {
    if (receiptItems.length === 0) return toast.error('Adicione pelo menos um produto');
    
    if (receiptItems.some(item => item.quantity === '' || item.quantity <= 0)) {
      return toast.error('Verifique as quantidades. Valores vazios ou zerados não são permitidos.');
    }
    
    try {
      const promessasDeEnvio = receiptItems.map(async (item) => {
        const qtyNumber = typeof item.quantity === 'number' ? item.quantity : 0;
        const alteracao = item.tipoMovimento === 'entrada' ? qtyNumber : -qtyNumber;
        const novoEstoque = item.currentStock + alteracao;

        if (novoEstoque < 0) {
          throw new Error(`Estoque insuficiente para a saída do produto: ${item.productName}`);
        }

        const resposta = await fetch(`/api/produtos/${item.productCode}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nome: item.productName,
            preco: item.preco, 
            qtde_estoque: novoEstoque,
            descricao: `${item.tipoMovimento.toUpperCase()}: Movimentação de estoque`,
            codu: usuarioAtual.codu
          })
        });
        if (!resposta.ok) throw new Error(`Erro ao salvar ${item.productName}`);
        return resposta.json(); 
      });

      await Promise.all(promessasDeEnvio);
      toast.success('Estoque atualizado com sucesso no Banco!');
      setReceiptItems([]);
      setTimeout(() => window.location.reload(), 1500);
    } catch (erro: any) {
      toast.error(erro.message || 'Erro ao salvar no banco.');
    }
  };

  return (
    <Box sx={{ p: 2, maxWidth: '1400px', mx: 'auto' }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Button variant="outlined" startIcon={<AddCircleOutline />} onClick={() => setModalOpen(true)}>
          Novo Produto
        </Button>
      </Box>

      <Paper className="p-6 mb-6" elevation={2}>
        <Typography variant="subtitle2" className="mb-2" sx={{ fontWeight: 'bold' }}>
          Adicionar por Código do Produto
        </Typography>
        <form onSubmit={handleBarcodeSubmit}>
          <Box display="flex" gap={2} mb={4} alignItems="center">
            <TextField 
              label="Código do Produto" 
              value={barcode} 
              onChange={(e) => setBarcode(e.target.value)} 
              sx={{ flexGrow: 1 }} 
            />
            <Button type="submit" variant="contained" startIcon={<Add />} sx={{ height: 56, minWidth: 130 }}>
              Adicionar
            </Button>
          </Box>
        </form>

        <Typography variant="subtitle2" className="mb-2" sx={{ fontWeight: 'bold' }}>
          Adicionar por Pesquisa
        </Typography>
        <Box display="flex" gap={2} alignItems="center">
          <Autocomplete
            options={productList}
            getOptionLabel={(option) => `${option.nome} (Estoque: ${option.qtde_estoque})`}
            renderInput={(params: any) => <TextField {...params} label="Buscar Produto" variant="outlined" />}
            value={productList.find(p => p.codp.toString() === selectedProduct) || null}
            onChange={(_, newValue) => setSelectedProduct(newValue ? newValue.codp.toString() : null)}
            sx={{ flexGrow: 1 }}
          />
          <Button variant="contained" onClick={handleAddItem} startIcon={<Add />} sx={{ height: 56, minWidth: 130 }}>
            Adicionar
          </Button>
        </Box>
      </Paper>

      {receiptItems.length > 0 && (
        <Paper className="p-6" elevation={2}>
          <Typography variant="h6" className="mb-4">Produtos a Movimentar</Typography>
          <TableContainer className="mb-4">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Produto</TableCell>
                  <TableCell>Tipo de Movimentação</TableCell>
                  <TableCell align="right">Estoque Atual</TableCell>
                  <TableCell align="right">Quantidade</TableCell>
                  <TableCell align="right">Novo Estoque</TableCell>
                  <TableCell align="center">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {receiptItems.map((item) => {
                  const qtyNumber = typeof item.quantity === 'number' ? item.quantity : 0;
                  const alteracao = item.tipoMovimento === 'entrada' ? qtyNumber : -qtyNumber;
                  const novoEstoque = item.currentStock + alteracao;

                  return (
                    <TableRow key={item.productCode}>
                      <TableCell>{item.productName}</TableCell>
                      <TableCell>
                        <TextField
                          select
                          value={item.tipoMovimento}
                          onChange={(e) => handleUpdateTipo(item.productCode, e.target.value as 'entrada' | 'saida')}
                          size="small"
                          sx={{ width: 130 }}
                        >
                          <MenuItem value="entrada">Entrada</MenuItem>
                          <MenuItem value="saida">Saída</MenuItem>
                        </TextField>
                      </TableCell>
                      <TableCell align="right">{item.currentStock}</TableCell>
                      <TableCell align="right">
                        {/* 🟢 Campo blindado sem setinhas nativas: aceita apenas números positivos e pode ficar vazio */}
                        <TextField 
                        type="number"
                        value={item.quantity} 
                        onChange={(e) => handleUpdateQuantity(item.productCode, e.target.value)} 
                        slotProps={{
                          htmlInput: { min: 0, step: 1 } // No MUI v5, use: inputProps={{ min: 0, step: 1 }}
                        }}
                        size="small" 
                        sx={{ width: 90 }} 
                        />
                      
                      </TableCell>
                      <TableCell align="right" className={`font-bold ${novoEstoque < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {novoEstoque}
                      </TableCell>
                      <TableCell align="center">
                        <IconButton size="small" color="error" onClick={() => handleRemoveItem(item.productCode)}>
                          <Delete />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          <Button variant="contained" size="large" fullWidth startIcon={<Save />} onClick={handleSaveReceipt}>
            Registrar e Atualizar Banco
          </Button>
        </Paper>
      )}

      {/* Modal de Novo Produto */}
      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Cadastrar Novo Produto</DialogTitle>
        <DialogContent dividers>
          <Box display="flex" flexDirection="column" gap={3} mt={1}>
            <TextField 
              label="Código do Produto (ID/Barras)" 
              fullWidth 
              value={novoProduto.codp} 
              onChange={(e) => setNovoProduto({ ...novoProduto, codp: e.target.value })} 
            />
            <TextField 
              label="Nome do Produto" 
              fullWidth 
              value={novoProduto.nome} 
              onChange={(e) => setNovoProduto({ ...novoProduto, nome: e.target.value })} 
            />
            {/* 🟢 Campo de Preço Custo blindado sem setinhas nativas: aceita apenas números e ponto decimal */}
            <TextField 
              label="Preço de Custo (R$)" 
              type="text"
              inputMode="decimal"
              fullWidth 
              value={novoProduto.preco} 
              onChange={(e) => {
                const cleanVal = e.target.value.replace(/[^0-9.]/g, '');
                const parts = cleanVal.split('.');
                const formattedVal = parts.length > 1 ? `${parts[0]}.${parts.slice(1).join('')}` : cleanVal;
                setNovoProduto({ ...novoProduto, preco: formattedVal });
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setModalOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleCadastrarNovoProduto}>Salvar Produto</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}