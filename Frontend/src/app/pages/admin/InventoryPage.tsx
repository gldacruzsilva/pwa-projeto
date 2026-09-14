import { useState, useEffect } from 'react';
import { 
  Paper, Typography, Button, Table, TableBody, TableCell, 
  TableContainer, TableHead, TableRow, TableFooter, Dialog, 
  DialogTitle, DialogContent, DialogActions, TextField, 
  IconButton, Box, Card, CardContent, Divider, useMediaQuery, useTheme 
} from '@mui/material';
import { Edit, Delete } from '@mui/icons-material';
import { toast } from 'sonner';

interface Product {
  id: number;
  code: string;
  name: string;
  quantity: number;
  price: number;
  costPrice: number;
  batch: string;
}

const formatarMoedaBrasileira = (valor: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor);
};

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({ code: '', name: '', quantity: '', price: '', costPrice: '', batch: '' });

  // 🟢 Hooks para detectar se é celular
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm')); // Retorna true em telas pequenas (celular)

  const usuarioString = localStorage.getItem('usuarioAtivo');
  const usuarioLogado = usuarioString ? JSON.parse(usuarioString) : { codu: 1 };

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/produtos');
      if (response.ok) {
        const dados = await response.json();
        const produtosFormatados = dados.map((item: any) => ({
          id: item.codp, code: item.codp.toString(), name: item.nome, quantity: item.qtde_estoque,
          price: Number(item.preco_venda ?? 0), costPrice: Number(item.preco_custo ?? 0), batch: item.lote || '1',
        }));
        setProducts(produtosFormatados);
      }
    } catch (erro) { toast.error('Erro ao conectar com o banco de dados.'); }
  };

  useEffect(() => { fetchProducts(); }, []);

  const handleOpenDialog = (product: Product) => {
    setEditingProduct(product);
    setFormData({ code: product.code, name: product.name, quantity: product.quantity.toString(), price: product.price.toString(), costPrice: product.costPrice.toString(), batch: product.batch });
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false); setEditingProduct(null);
    setFormData({ code: '', name: '', quantity: '', price: '', costPrice: '', batch: '' });
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.price.trim()) return toast.error('Preencha os campos obrigatórios');
    try {
      if (editingProduct) {
        const response = await fetch(`/api/produtos/${editingProduct.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nome: formData.name, 
            preco_venda: parseFloat(formData.price), 
            qtde_estoque: editingProduct.quantity,
            preco_custo: editingProduct.costPrice, 
            lote: editingProduct.batch, 
            lote_original: editingProduct.batch,
            codu: usuarioLogado.codu
          })
        });
        if (response.ok) {
          toast.success('Produto atualizado com sucesso');
          handleCloseDialog();
          fetchProducts(); 
        } else { toast.error('Falha ao atualizar'); }
      }
    } catch (erro) { toast.error('Erro ao salvar'); }
  };

  const handleOpenDeleteDialog = (product: Product) => {
    setDeletingProduct(product);
    setOpenDeleteDialog(true);
  };

  const handleCloseDeleteDialog = () => {
    setOpenDeleteDialog(false);
    setDeletingProduct(null);
  };

  const handleDelete = async () => {
    if (!deletingProduct) return;
    try {
      const response = await fetch(`/api/produtos/${deletingProduct.id}?lote=${encodeURIComponent(deletingProduct.batch)}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        toast.success('Produto excluído com sucesso');
        fetchProducts();
      } else { toast.error('Erro ao excluir produto.'); }
    } catch (erro) { toast.error('Erro de conexão.'); }
    handleCloseDeleteDialog();
  };

  const totalItems = products.reduce((acc, product) => acc + product.quantity, 0);
  const totalValue = products.reduce((acc, product) => acc + (product.quantity * product.costPrice), 0);

  return (
    <Box>
      <Box className="mb-6"></Box>
      
      {/* 🟢 RENDERIZAÇÃO CONDICIONAL: CARDS NO CELULAR, TABELA NO PC */}
      {isMobile ? (
        <Box display="flex" flexDirection="column" gap={2}>
          {products.map((product) => (
            <Card key={`${product.id}-${product.batch}`} variant="outlined">
              <CardContent sx={{ pb: '16px !important' }}>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                  <Box>
                    <Typography variant="h6" component="div" lineHeight={1.2} mb={0.5}>
                      {product.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Cód: {product.code} | Lote: {product.batch}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <IconButton size="small" color="primary" onClick={() => handleOpenDialog(product)}><Edit /></IconButton>
                    <IconButton size="small" color="error" onClick={() => handleOpenDeleteDialog(product)}><Delete /></IconButton>
                  </Box>
                </Box>
                
                <Divider sx={{ my: 1.5 }} />
                
                <Box display="flex" flexWrap="wrap" rowGap={1.5}>
                  <Box width="50%">
                    <Typography variant="caption" color="text.secondary" display="block">Estoque</Typography>
                    <Typography variant="body2" fontWeight="medium">{product.quantity} un</Typography>
                  </Box>
                  <Box width="50%">
                    <Typography variant="caption" color="text.secondary" display="block">Total (Estoque)</Typography>
                    <Typography variant="body2" color="success.main" fontWeight="bold">
                      {formatarMoedaBrasileira(product.quantity * product.costPrice)}
                    </Typography>
                  </Box>
                  <Box width="50%">
                    <Typography variant="caption" color="text.secondary" display="block">Preço de Custo</Typography>
                    <Typography variant="body2">{formatarMoedaBrasileira(product.costPrice)}</Typography>
                  </Box>
                  <Box width="50%">
                    <Typography variant="caption" color="text.secondary" display="block">Preço de Venda</Typography>
                    <Typography variant="body2">{formatarMoedaBrasileira(product.price)}</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))}
          
          {/* Card de Totais (Mobile) */}
          {products.length > 0 && (
            <Card sx={{ backgroundColor: (theme) => theme.palette.mode === 'dark' ? '#272727' : '#f5f5f5', mt: 2 }}>
              <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 2, '&:last-child': { pb: 2 } }}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Total de Itens</Typography>
                  <Typography variant="h6" fontWeight="bold">{totalItems}</Typography>
                </Box>
                <Box textAlign="right">
                  <Typography variant="subtitle2" color="text.secondary">Valor Total</Typography>
                  <Typography variant="h6" fontWeight="bold" color="success.main">{formatarMoedaBrasileira(totalValue)}</Typography>
                </Box>
              </CardContent>
            </Card>
          )}
        </Box>
      ) : (
        // 🟢 TABELA ORIGINAL (mantida para Desktop)
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Código</TableCell><TableCell>Nome</TableCell><TableCell align="center">Lote</TableCell>
                <TableCell align="center">Quantidade</TableCell><TableCell align="center">Preço de custo</TableCell>
                <TableCell align="center">Preço de venda</TableCell><TableCell align="center">Total (Estoque)</TableCell>
                <TableCell align="center">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {products.map((product) => (
                <TableRow key={`${product.id}-${product.batch}`}>
                  <TableCell>{product.code}</TableCell><TableCell>{product.name}</TableCell>
                  <TableCell align="center">{product.batch}</TableCell><TableCell align="center">{product.quantity}</TableCell>
                  <TableCell align="center">{formatarMoedaBrasileira(product.costPrice)}</TableCell><TableCell align="center">{formatarMoedaBrasileira(product.price)}</TableCell>
                  <TableCell align="center" className="text-green-600 dark:text-green-400 font-medium">{formatarMoedaBrasileira(product.quantity * product.costPrice)}</TableCell>
                  <TableCell align="center">
                    <IconButton size="small" color="primary" onClick={() => handleOpenDialog(product)}><Edit /></IconButton>
                    <IconButton size="small" color="error" onClick={() => handleOpenDeleteDialog(product)}><Delete /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            {products.length > 0 && (
              <TableFooter>
                <TableRow sx={{ backgroundColor: (theme) => theme.palette.mode === 'dark' ? '#272727' : '#f5f5f5' }}>
                  <TableCell colSpan={3} align="left"><Typography variant="subtitle1" fontWeight="bold">Total</Typography></TableCell>
                  <TableCell align="center"><Typography variant="subtitle1" fontWeight="bold">{totalItems}</Typography></TableCell>
                  <TableCell></TableCell><TableCell></TableCell>
                  <TableCell align="center"><Typography variant="subtitle1" fontWeight="bold" color="success.main">{formatarMoedaBrasileira(totalValue)}</Typography></TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </TableContainer>
      )}

      {/* 🟢 AJUSTE DE PWA: No celular o dialog de edição ocupa a tela toda (fullScreen={isMobile}) */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle>Editar Produto</DialogTitle>
        <DialogContent dividers>
          <Box display="flex" flexDirection="column" gap={3} mt={1}>
            <TextField fullWidth label="Código de Barras (ID)" value={formData.code} disabled />
            <TextField fullWidth label="Nome do Produto" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
            <Box display="flex" gap={2}>
              <TextField fullWidth label="Lote Atual" value={formData.batch} disabled />
              <TextField fullWidth label="Preço de Custo (R$)" type="number" value={formData.costPrice} disabled />
            </Box>
            <TextField fullWidth label="Quantidade" type="number" value={formData.quantity} disabled helperText="Para alterar a quantidade, utilize a aba de Movimentação de Estoque." />
            <TextField fullWidth label="Preço de Comanda (R$)" type="number" inputProps={{ step: '0.01' }} value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} required />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancelar</Button>
          <Button onClick={handleSave} variant="contained">Salvar Alterações</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openDeleteDialog} onClose={handleCloseDeleteDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Confirmar Exclusão</DialogTitle>
        <DialogContent>
          {deletingProduct && <Typography className="mt-2">Tem certeza que deseja excluir permanentemente o produto <strong>{deletingProduct.name} Lote {deletingProduct.batch}</strong>?</Typography>}
        </DialogContent>
        <DialogActions><Button onClick={handleCloseDeleteDialog}>Cancelar</Button><Button onClick={handleDelete} variant="contained" color="error">Excluir</Button></DialogActions>
      </Dialog>
    </Box>
  );
}