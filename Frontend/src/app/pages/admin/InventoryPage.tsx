import { useState, useEffect } from 'react';
import { 
  Paper, Typography, Button, Table, TableBody, TableCell, 
  TableContainer, TableHead, TableRow, TableFooter, Dialog, 
  DialogTitle, DialogContent, DialogActions, TextField, 
  IconButton, Box, Card, CardContent, Divider, useMediaQuery, useTheme, Alert 
} from '@mui/material';
import { Edit, Delete, RestoreFromTrash, Info } from '@mui/icons-material';
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

// Caminho relativo para funcionar tanto no PC quanto no Celular
const API_URL = '/api';

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({ code: '', name: '', quantity: '', price: '', costPrice: '', batch: '' });

  const [openTrashDialog, setOpenTrashDialog] = useState(false);
  const [trashProducts, setTrashProducts] = useState<Product[]>([]);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm')); 

  const usuarioString = localStorage.getItem('usuarioAtivo');
  const usuarioLogado = usuarioString ? JSON.parse(usuarioString) : { codu: 1 };

  const fetchProducts = async () => {
    try {
      const response = await fetch(`${API_URL}/produtos?status=1`);
      if (response.ok) {
        const dados = await response.json();
        const produtosAtivos = dados.filter((item: any) => item.status === 1 || item.status === undefined);
        
        const produtosFormatados = produtosAtivos.map((item: any) => ({
          id: item.codp, code: item.codp.toString(), name: item.nome, quantity: item.qtde_estoque,
          price: Number(item.preco_venda ?? 0), costPrice: Number(item.preco_custo ?? 0), batch: item.lote || '1',
        }));
        setProducts(produtosFormatados);
      } else {
        toast.error('Erro na resposta do servidor.');
      }
    } catch (erro) { 
        toast.error('Erro ao conectar com o banco de dados. Verifique se o backend está rodando.'); 
        console.error("Erro fetchProducts:", erro);
    }
  };

  const fetchTrashProducts = async () => {
    try {
      const response = await fetch(`${API_URL}/produtos?status=0`);
      if (response.ok) {
        const dados = await response.json();
        const produtosInativos = dados.filter((item: any) => item.status === 0);
        
        const produtosFormatados = produtosInativos.map((item: any) => ({
          id: item.codp, code: item.codp.toString(), name: item.nome, quantity: item.qtde_estoque,
          price: Number(item.preco_venda ?? 0), costPrice: Number(item.preco_custo ?? 0), batch: item.lote || '1',
        }));
        setTrashProducts(produtosFormatados);
      }
    } catch (erro) { toast.error('Erro ao carregar a lixeira.'); }
  };

  useEffect(() => { fetchProducts(); }, []);

  useEffect(() => {
    if (openTrashDialog) fetchTrashProducts();
  }, [openTrashDialog]);

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
        const response = await fetch(`${API_URL}/produtos/${editingProduct.id}`, {
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
      const response = await fetch(`${API_URL}/produtos/${deletingProduct.id}?lote=${encodeURIComponent(deletingProduct.batch)}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        toast.success('Produto inativado com sucesso.');
        fetchProducts();
      } else { toast.error('Erro ao inativar produto.'); }
    } catch (erro) { toast.error('Erro de conexão.'); }
    handleCloseDeleteDialog();
  };

  const handleRestore = async (product: Product) => {
    try {
      const response = await fetch(`${API_URL}/produtos/${product.id}/reativar`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lote: product.batch })
      });
      if (response.ok) {
        toast.success('Produto restaurado com sucesso!');
        fetchTrashProducts();
        fetchProducts();      
      } else {
        toast.error('Erro ao restaurar o produto.');
      }
    } catch (erro) { toast.error('Erro de conexão.'); }
  };

  const totalItems = products.reduce((acc, product) => acc + product.quantity, 0);
  const totalValue = products.reduce((acc, product) => acc + (product.quantity * product.costPrice), 0);

  return (
    <Box>
      <Box mb={4} display="flex" justifyContent="flex-start">
        <Button 
          variant="outlined" 
          color="primary" 
          startIcon={<RestoreFromTrash />} 
          onClick={() => setOpenTrashDialog(true)}
          fullWidth={isMobile}
          sx={{ height: isMobile ? 48 : 'auto' }}
        >
          Produtos inativos
        </Button>
      </Box>
      
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
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Código</TableCell>
                <TableCell>Nome</TableCell>
                <TableCell align="center">Lote</TableCell>
                <TableCell align="center">Quantidade</TableCell>
                <TableCell align="center">Preço de custo</TableCell>
                <TableCell align="center">Preço de venda</TableCell>
                <TableCell align="center">Total (Estoque)</TableCell>
                <TableCell align="center">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {products.map((product) => (
                <TableRow key={`${product.id}-${product.batch}`}>
                  <TableCell>{product.code}</TableCell>
                  <TableCell>{product.name}</TableCell>
                  <TableCell align="center">{product.batch}</TableCell>
                  <TableCell align="center">{product.quantity}</TableCell>
                  <TableCell align="center">{formatarMoedaBrasileira(product.costPrice)}</TableCell>
                  <TableCell align="center">{formatarMoedaBrasileira(product.price)}</TableCell>
                  <TableCell align="center" className="text-green-600 dark:text-green-400 font-medium">
                    {formatarMoedaBrasileira(product.quantity * product.costPrice)}
                  </TableCell>
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

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle>Editar Produto</DialogTitle>
        <DialogContent dividers>
          <Box display="flex" flexDirection="column" gap={3} mt={1}>
            <TextField fullWidth label="Código de Barras (ID)" value={formData.code} disabled />
            <TextField fullWidth label="Nome do Produto" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
            <Box display="flex" gap={2} flexDirection={isMobile ? 'column' : 'row'}>
              <TextField fullWidth label="Lote Atual" value={formData.batch} disabled />
              <TextField fullWidth label="Preço de Custo (R$)" type="number" value={formData.costPrice} disabled />
            </Box>
            <TextField fullWidth label="Quantidade" type="number" value={formData.quantity} disabled helperText="Para alterar a quantidade, utilize a aba de Movimentação de Estoque." />
            <TextField fullWidth label="Preço de Comanda (R$)" type="number" inputProps={{ step: '0.01' }} value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} required />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleCloseDialog}>Cancelar</Button>
          <Button onClick={handleSave} variant="contained">Salvar Alterações</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openDeleteDialog} onClose={handleCloseDeleteDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Confirmar Inatividade</DialogTitle>
        <DialogContent>
          {deletingProduct && (
            <Box mt={1}>
              <Typography>
                Tem certeza que deseja inativar o produto <strong>{deletingProduct.name} Lote {deletingProduct.batch}</strong>?
              </Typography>
              
              <Alert icon={<Info fontSize="inherit" />} severity="info" sx={{ mt: 2 }}>
                Ele será movido para a aba de produtos inativos e deixará de aparecer no sistema. Você poderá restaurá-lo mais tarde.
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleCloseDeleteDialog}>Cancelar</Button>
          <Button onClick={handleDelete} variant="contained" color="error">Excluir</Button>
        </DialogActions>
      </Dialog>

      {/* DIALOG DE LIXEIRA (INATIVOS) */}
      <Dialog open={openTrashDialog} onClose={() => setOpenTrashDialog(false)} maxWidth="md" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <RestoreFromTrash color="action" /> Produtos inativos
        </DialogTitle>
        <DialogContent dividers sx={{ p: isMobile ? 2 : 3 }}>
          {trashProducts.length === 0 ? (
            <Alert severity="success">Nenhum produto inativo no momento.</Alert>
          ) : isMobile ? (
            /* 🟢 VISUALIZAÇÃO EM CARDS NO CELULAR */
            <Box display="flex" flexDirection="column" gap={2}>
              {trashProducts.map((p, i) => (
                <Card key={p.id || i} variant="outlined">
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                      <Box>
                        <Typography variant="subtitle1" fontWeight="bold" lineHeight={1.2}>
                          {p.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Cód: {p.code} | Lote: {p.batch}
                        </Typography>
                      </Box>
                      <Box textAlign="right">
                        <Typography variant="caption" color="text.secondary" display="block">Estoque Retido</Typography>
                        <Typography variant="body2" fontWeight="bold">{p.quantity} un</Typography>
                      </Box>
                    </Box>

                    <Divider sx={{ my: 1.5 }} />

                    <Button 
                      variant="contained" 
                      color="success" 
                      size="small" 
                      fullWidth 
                      startIcon={<RestoreFromTrash />}
                      onClick={() => handleRestore(p)}
                    >
                      Restaurar Produto
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </Box>
          ) : (
            /* 🟢 VISUALIZAÇÃO EM TABELA NO DESKTOP */
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Código</TableCell>
                    <TableCell>Nome</TableCell>
                    <TableCell>Lote</TableCell>
                    <TableCell>Estoque Retido</TableCell>
                    <TableCell align="center">Ação</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {trashProducts.map((p, i) => (
                    <TableRow key={i}>
                      <TableCell>{p.code}</TableCell>
                      <TableCell>{p.name}</TableCell>
                      <TableCell>{p.batch}</TableCell>
                      <TableCell>{p.quantity}</TableCell>
                      <TableCell align="center">
                        <Button 
                          variant="outlined" 
                          color="success" 
                          size="small"
                          onClick={() => handleRestore(p)}
                        >
                          Restaurar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenTrashDialog(false)}>Fechar Lixeira</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}