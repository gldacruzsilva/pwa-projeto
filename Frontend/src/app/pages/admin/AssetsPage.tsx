import { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableFooter,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Box,
  Alert,
  Card,
  CardContent,
  Divider,
  useTheme,
  useMediaQuery,
  Autocomplete,
  MenuItem
} from '@mui/material';
import { Edit, Delete, SwapHoriz, AddCircleOutline, RestoreFromTrash } from '@mui/icons-material';
import { toast } from 'sonner';

interface Asset {
  id: number;
  code: string;
  name: string;
  quantity: number;
  value: number;
}

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [trashAssets, setTrashAssets] = useState<Asset[]>([]);

  const [openMovimentoDialog, setOpenMovimentoDialog] = useState(false);
  const [openNovoDialog, setOpenNovoDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [openTrashDialog, setOpenTrashDialog] = useState(false);

  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [deletingAsset, setDeletingAsset] = useState<Asset | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  
  const [tipoMovimento, setTipoMovimento] = useState<'entrada' | 'saida'>('entrada');
  const [qtdMovimento, setQtdMovimento] = useState('');
  const [motivoMovimento, setMotivoMovimento] = useState('');

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    quantity: '',
    value: '',
  });

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const usuarioString = localStorage.getItem('usuarioAtivo');
  const usuarioLogado = usuarioString 
    ? JSON.parse(usuarioString) 
    : { nome: 'admin', tipo: 'admin', codu: 1 };

  const isAdmin = usuarioLogado.tipo?.toLowerCase() === 'admin';

  // Formatador de Moeda
  const formatarMoedaBrasileira = (valor: number): string => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
  };

  const fetchAssets = async () => {
    try {
      const response = await fetch('/api/bens?status=1');
      if (response.ok) {
        const dados = await response.json();
        const ativosFormatados = dados.map((item: any) => ({
          id: item.coda, 
          code: item.coda.toString(), 
          name: item.nome,
          quantity: Number(item.qtde), 
          value: Number(item.valor),
        }));
        setAssets(ativosFormatados);
      }
    } catch (erro) {
      toast.error('Erro ao conectar com o banco de dados.');
    }
  };

  const fetchTrashAssets = async () => {
    try {
      const response = await fetch('/api/bens?status=0');
      if (response.ok) {
        const dados = await response.json();
        const ativosInativos = dados.map((item: any) => ({
          id: item.coda, 
          code: item.coda.toString(), 
          name: item.nome,
          quantity: Number(item.qtde), 
          value: Number(item.valor),
        }));
        setTrashAssets(ativosInativos);
      }
    } catch (erro) {
      toast.error('Erro ao carregar a lixeira.');
    }
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  useEffect(() => {
    if (openTrashDialog) fetchTrashAssets();
  }, [openTrashDialog]);

  const handleSaveMovimento = async () => {
    if (!isAdmin) {
      toast.error('Acesso negado. Apenas administradores podem movimentar ativos.');
      return;
    }
    if (!selectedAsset) {
      toast.error('Selecione um ativo');
      return;
    }
    const qtdeNum = parseInt(qtdMovimento);
    if (isNaN(qtdeNum) || qtdeNum <= 0) {
      toast.error('Informe uma quantidade válida');
      return;
    }

    const alteracao = tipoMovimento === 'entrada' ? qtdeNum : -qtdeNum;
    const novoEstoque = selectedAsset.quantity + alteracao;

    if (novoEstoque < 0) {
      toast.error('Quantidade insuficiente para registrar esta saída!');
      return;
    }

    let textoMotivo = motivoMovimento.trim() || 'Ajuste';
    if (textoMotivo.length > 20) {
      textoMotivo = textoMotivo.substring(0, 20) + '...';
    }

    try {
      const response = await fetch(`/api/bens/${selectedAsset.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: selectedAsset.name,
          qtde: novoEstoque,
          valor: selectedAsset.value,
          descricao: `${tipoMovimento.toUpperCase()}: ${textoMotivo}`, 
          codu: usuarioLogado?.codu || 1
        })
      });

      if (response.ok) {
        toast.success(`Movimentação de ${tipoMovimento} registrada com sucesso!`);
        setOpenMovimentoDialog(false);
        setTimeout(() => window.location.reload(), 1500);
      } else {
        const errorData = await response.json().catch(() => ({}));
        if (errorData.detalhe) toast.error(`Erro MySQL: ${errorData.detalhe}`);
        else toast.error(errorData.mensagem || 'Falha ao atualizar movimentação.');
      }
    } catch (erro) {
      toast.error('Erro de conexão ao registrar movimentação.');
    }
  };

  const handleSaveNovoAtivo = async () => {
    if (!isAdmin) return toast.error('Acesso negado.');
    if (!formData.name.trim() || !formData.quantity.trim() || !formData.value.trim()) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      const response = await fetch('/api/bens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: formData.name,
          qtde: parseInt(formData.quantity), 
          valor: parseFloat(formData.value),
          descricao: 'ENTRADA: Novo ativo', 
          codu: usuarioLogado?.codu || 1,
        })
      });

      if (response.ok) {
        toast.success('Novo ativo cadastrado com sucesso!');
        setOpenNovoDialog(false);
        setTimeout(() => window.location.reload(), 1500);
      } else {
        const errorData = await response.json().catch(() => ({}));
        if (errorData.detalhe) toast.error(`${errorData.detalhe}`);
        else toast.error(errorData.mensagem || 'Falha ao cadastrar ativo no banco.');
      }
    } catch (erro) {
      toast.error('Erro de rede ao tentar cadastrar ativo.');
    }
  };

  const handleSaveEdit = async () => {
    if (!isAdmin) return toast.error('Acesso negado.');
    if (!editingAsset) return;
    try {
      const response = await fetch(`/api/bens/${editingAsset.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: formData.name,
          qtde: editingAsset.quantity, 
          valor: parseFloat(formData.value),
          descricao: 'EDIÇÃO: Dados atualizados', 
          codu: usuarioLogado?.codu || 1
        })
      });

      if (response.ok) {
        toast.success('Ativo atualizado com sucesso!');
        setOpenEditDialog(false);
        setTimeout(() => window.location.reload(), 1500);
      } else {
        const errorData = await response.json().catch(() => ({}));
        if (errorData.detalhe) toast.error(`Erro MySQL: ${errorData.detalhe}`);
        else toast.error(errorData.mensagem || 'Falha ao atualizar ativo.');
      }
    } catch (erro) {
      toast.error('Erro de rede ao atualizar ativo.');
    }
  };

  const handleDelete = async () => {
    if (!isAdmin) return toast.error('Acesso negado.');
    if (!deletingAsset) return;
    try {
      const response = await fetch(`/api/bens/${deletingAsset.id}`, { method: 'DELETE' });

      if (response.ok) {
        toast.success('Ativo movido para a lixeira!');
        setOpenDeleteDialog(false);
        fetchAssets(); 
      } else {
        toast.error('Falha ao inativar o ativo.');
      }
    } catch (erro) { toast.error('Erro de conexão.'); }
  };

  const handleRestore = async (asset: Asset) => {
    try {
      const response = await fetch(`/api/bens/${asset.id}/reativar`, { method: 'PUT' });
      if (response.ok) {
        toast.success('Ativo restaurado com sucesso!');
        fetchTrashAssets();
        fetchAssets();
      } else {
        toast.error('Erro ao restaurar ativo.');
      }
    } catch (erro) { toast.error('Erro de conexão.'); }
  };

  const totalItems = assets.reduce((acc, asset) => acc + Number(asset.quantity), 0);
  const totalValue = assets.reduce((acc, asset) => acc + (Number(asset.quantity) * Number(asset.value)), 0);

  return (
    <Box>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, mb: 4 }}>
        {isAdmin ? (
          <>
            <Button
              variant="outlined"
              startIcon={<AddCircleOutline />}
              fullWidth={isMobile}
              sx={{ height: 48 }}
              onClick={() => { setFormData({ code: '', name: '', quantity: '', value: '' }); setOpenNovoDialog(true); }}
            >
              Cadastrar Novo Ativo
            </Button>
            <Button
              variant="contained"
              startIcon={<SwapHoriz />}
              fullWidth={isMobile}
              sx={{ height: 48 }}
              onClick={() => setOpenMovimentoDialog(true)}
            >
              Registrar Entrada/Saída
            </Button>
            <Button 
              variant="outlined" 
              color="primary" 
              startIcon={<RestoreFromTrash />} 
              fullWidth={isMobile}
              sx={{ height: 48 }}
              onClick={() => setOpenTrashDialog(true)}
            >
              Inativos
            </Button>
          </>
        ) : (
          <Alert severity="warning" sx={{ width: '100%' }}>Área restrita a administradores.</Alert>
        )}
      </Box>

      {isMobile ? (
        <Box display="flex" flexDirection="column" gap={2}>
          {assets.map((asset) => (
            <Card key={asset.id} variant="outlined">
              <CardContent sx={{ pb: '16px !important' }}>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                  <Box>
                    <Typography variant="h6" fontWeight="bold" lineHeight={1.2}>{asset.name}</Typography>
                    <Typography variant="body2" color="text.secondary">Cód: {asset.code}</Typography>
                  </Box>
                  {isAdmin && (
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      {/* 🟢 BOTÃO DE EDITAR NO CELULAR DE VOLTA */}
                      <IconButton 
                        size="small" 
                        color="primary" 
                        onClick={() => {
                          setEditingAsset(asset);
                          setFormData({ code: asset.code, name: asset.name, quantity: String(asset.quantity), value: String(asset.value) });
                          setOpenEditDialog(true);
                        }}
                      >
                        <Edit />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => { setDeletingAsset(asset); setOpenDeleteDialog(true); }}>
                        <Delete />
                      </IconButton>
                    </Box>
                  )}
                </Box>
                <Divider sx={{ my: 1.5 }} />
                <Box display="flex" flexWrap="wrap" rowGap={1.5}>
                  <Box width="50%">
                    <Typography variant="caption" color="text.secondary" display="block">Qtd</Typography>
                    <Typography variant="body2">{asset.quantity} un</Typography>
                  </Box>
                  <Box width="50%">
                    <Typography variant="caption" color="text.secondary" display="block">Valor (un)</Typography>
                    <Typography variant="body2">{formatarMoedaBrasileira(asset.value)}</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Código</TableCell>
                <TableCell>Nome do Ativo</TableCell>
                <TableCell align="center">Qtd</TableCell>
                <TableCell align="center">Valor Base</TableCell>
                <TableCell align="center">Total</TableCell>
                {isAdmin && <TableCell align="center">Ações</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {assets.map((asset) => (
                <TableRow key={asset.id}>
                  <TableCell>{asset.code}</TableCell>
                  <TableCell>{asset.name}</TableCell>
                  <TableCell align="center">{asset.quantity}</TableCell>
                  <TableCell align="center">{formatarMoedaBrasileira(asset.value)}</TableCell>
                  <TableCell align="center" className="text-green-600 font-medium">
                    {formatarMoedaBrasileira(asset.quantity * asset.value)}
                  </TableCell>
                  {isAdmin && (
                    <TableCell align="center">
                      {/* 🟢 BOTÃO DE EDITAR NO PC DE VOLTA */}
                      <IconButton 
                        size="small" 
                        color="primary" 
                        sx={{ mr: 1 }}
                        onClick={() => {
                          setEditingAsset(asset);
                          setFormData({ code: asset.code, name: asset.name, quantity: String(asset.quantity), value: String(asset.value) });
                          setOpenEditDialog(true);
                        }}
                      >
                        <Edit />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => { setDeletingAsset(asset); setOpenDeleteDialog(true); }}>
                        <Delete />
                      </IconButton>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
            {assets.length > 0 && (
              <TableFooter>
                <TableRow sx={{ backgroundColor: (theme) => theme.palette.mode === 'dark' ? '#272727' : '#f5f5f5' }}>
                  <TableCell colSpan={2}><Typography fontWeight="bold">Total Patrimônio</Typography></TableCell>
                  <TableCell align="center"><Typography fontWeight="bold">{totalItems}</Typography></TableCell>
                  <TableCell></TableCell>
                  <TableCell align="center"><Typography fontWeight="bold" color="success.main">{formatarMoedaBrasileira(totalValue)}</Typography></TableCell>
                  {isAdmin && <TableCell></TableCell>}
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </TableContainer>
      )}

      {/* DIALOG DE LIXEIRA */}
      <Dialog open={openTrashDialog} onClose={() => setOpenTrashDialog(false)} maxWidth="md" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <RestoreFromTrash color="action" /> Inativos
        </DialogTitle>
        <DialogContent dividers>
          {trashAssets.length === 0 ? (
            <Alert severity="success">Nenhum ativo inativo no momento.</Alert>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Código</TableCell>
                    <TableCell>Nome</TableCell>
                    <TableCell>Quantidade</TableCell>
                    <TableCell align="center">Ação</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {trashAssets.map((a, i) => (
                    <TableRow key={i}>
                      <TableCell>{a.code}</TableCell>
                      <TableCell>{a.name}</TableCell>
                      <TableCell>{a.quantity}</TableCell>
                      <TableCell align="center">
                        <Button variant="outlined" color="success" size="small" onClick={() => handleRestore(a)}>
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
        <DialogActions>
          <Button onClick={() => setOpenTrashDialog(false)}>Fechar Lixeira</Button>
        </DialogActions>
      </Dialog>

      {/* MODAL 1: MOVIMENTAÇÃO */}
      <Dialog open={openMovimentoDialog} onClose={() => setOpenMovimentoDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Movimentação de Ativos</DialogTitle>
        <DialogContent dividers>
          <Box display="flex" flexDirection="column" gap={3} mt={1}>
            <Alert severity="info">
              Registre a entrada de novos itens ou a baixa por quebras, perdas ou vendas. A quantidade atual será atualizada automaticamente.
            </Alert>
            <Autocomplete
              options={assets}
              getOptionLabel={(o) => `${o.name} (Atual: ${o.quantity})`}
              renderInput={(params: any) => <TextField {...params} label="Selecionar Ativo" required />}
              value={selectedAsset}
              onChange={(_, nv) => setSelectedAsset(nv)}
            />
            <TextField
              select
              fullWidth
              label="Tipo de Movimentação"
              value={tipoMovimento}
              onChange={(e) => setTipoMovimento(e.target.value as 'entrada' | 'saida')}
            >
              <MenuItem value="entrada"> Entrada </MenuItem>
              <MenuItem value="saida"> Saída </MenuItem>
            </TextField>
            <TextField
              fullWidth
              label="Quantidade"
              type="number"
              value={qtdMovimento}
              onChange={(e) => setQtdMovimento(e.target.value)}
              required
            />
            <TextField
              fullWidth
              label="Descrição (Opcional)"
              multiline
              rows={2}
              value={motivoMovimento}
              onChange={(e) => setMotivoMovimento(e.target.value)}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenMovimentoDialog(false)}>Cancelar</Button>
          <Button onClick={handleSaveMovimento} variant="contained">Confirmar</Button>
        </DialogActions>
      </Dialog>

      {/* MODAL 2: NOVO ATIVO */}
      <Dialog open={openNovoDialog} onClose={() => setOpenNovoDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Cadastrar Ativo</DialogTitle>
        <DialogContent dividers>
          <Box display="flex" flexDirection="column" gap={3} mt={1}>
            <TextField fullWidth label="Nome do Ativo" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
            <TextField fullWidth label="Quantidade Inicial" type="number" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} required />
            <TextField fullWidth label="Preço Unitário (R$)" type="number" inputProps={{ step: '0.01' }} value={formData.value} onChange={(e) => setFormData({ ...formData, value: e.target.value })} required />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenNovoDialog(false)}>Cancelar</Button>
          <Button onClick={handleSaveNovoAtivo} variant="contained">Salvar</Button>
        </DialogActions>
      </Dialog>

      {/* MODAL 3: EDITAR */}
      <Dialog open={openEditDialog} onClose={() => setOpenEditDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Editar Ativo</DialogTitle>
        <DialogContent dividers>
          <Box display="flex" flexDirection="column" gap={3} mt={1}>
            <TextField fullWidth label="Código" value={formData.code} disabled />
            <TextField fullWidth label="Nome do Ativo" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
            <TextField fullWidth label="Preço Unitário (R$)" type="number" inputProps={{ step: '0.01' }} value={formData.value} onChange={(e) => setFormData({ ...formData, value: e.target.value })} required />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenEditDialog(false)}>Cancelar</Button>
          <Button onClick={handleSaveEdit} variant="contained">Salvar Alterações</Button>
        </DialogActions>
      </Dialog>

      {/* MODAL 4: CONFIRMAR EXCLUSÃO / INATIVAR */}
      <Dialog open={openDeleteDialog} onClose={() => setOpenDeleteDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Confirmar Exclusão</DialogTitle>
        <DialogContent>
          <Box mt={1}>
            {deletingAsset && (
              <Typography>
                Tem certeza que deseja inativar o <strong>{deletingAsset.name}</strong>?
              </Typography>
            )}
            <Alert severity="info" sx={{ mt: 2 }}>Ele será movido para a lixeira e você poderá restaurá-lo mais tarde.</Alert>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenDeleteDialog(false)}>Cancelar</Button>
          <Button onClick={handleDelete} variant="contained" color="error">Excluir</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}