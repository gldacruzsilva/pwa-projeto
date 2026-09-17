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
  Autocomplete,
  MenuItem,
  Alert,
} from '@mui/material';
import { Edit, Delete, SwapHoriz, AddCircleOutline } from '@mui/icons-material';
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
  
  const [openMovimentoDialog, setOpenMovimentoDialog] = useState(false);
  const [openNovoDialog, setOpenNovoDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  
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

  const usuarioString = localStorage.getItem('usuarioAtivo');
  const usuarioLogado = usuarioString 
    ? JSON.parse(usuarioString) 
    : { nome: 'admin', tipo: 'admin', codu: 1 };

  const isAdmin = usuarioLogado.tipo?.toLowerCase() === 'admin';

  const fetchAssets = async () => {
    try {
      const response = await fetch('/api/bens');
      if (response.ok) {
        const dados = await response.json();
        const ativosFormatados = dados.map((item: any) => ({
          // CORREÇÃO: Usando 'coda' que é o nome da coluna no seu backend, em vez de 'codi'
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

  useEffect(() => {
    fetchAssets();
  }, []);

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
    // CORREÇÃO: Removida a validação do formData.code
    if (!formData.name.trim() || !formData.quantity.trim() || !formData.value.trim()) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      const response = await fetch('/api/bens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // CORREÇÃO: O banco com Auto-Increment vai gerar o 'coda'. 
          // Retirado o envio do formData.code.
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
        if (errorData.detalhe) toast.error(`Erro MySQL: ${errorData.detalhe}`);
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
      const response = await fetch(`/api/bens/${deletingAsset.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Ativo excluído com sucesso!');
        setOpenDeleteDialog(false);
        setTimeout(() => window.location.reload(), 1500);
      } else {
        toast.error('Falha ao excluir o ativo.');
      }
    } catch (erro) {
      toast.error('Erro de conexão.');
    }
  };

  const totalItems = assets.reduce((acc, asset) => acc + Number(asset.quantity), 0);
  const totalValue = assets.reduce((acc, asset) => acc + (Number(asset.quantity) * Number(asset.value)), 0);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', mb: 4 }}>
        {isAdmin ? (
          <Box display="flex" gap={2}>
            <Button
              variant="outlined"
              startIcon={<AddCircleOutline />}
              onClick={() => {
                setFormData({ code: '', name: '', quantity: '', value: '' });
                setOpenNovoDialog(true);
              }}
            >
              Cadastrar Novo Ativo
            </Button>
            <Button
              variant="contained"
              startIcon={<SwapHoriz />}
              onClick={() => setOpenMovimentoDialog(true)}
            >
              Registrar Entrada ou Saída
            </Button>
          </Box>
        ) : (
          <Alert severity="warning">Área restrita a administradores. Funcionários gerenciam apenas o estoque.</Alert>
        )}
      </Box>
        
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Código</TableCell>
              <TableCell>Nome</TableCell>
              <TableCell align="right">Quantidade</TableCell>
              <TableCell align="right">Valor Unitário</TableCell>
              <TableCell align="right">Total</TableCell>
              {isAdmin && <TableCell align="center">Ações</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {assets.map((asset) => (
              <TableRow key={asset.id}>
                <TableCell>{asset.code}</TableCell>
                <TableCell>{asset.name}</TableCell>
                <TableCell align="right">{asset.quantity}</TableCell>
                <TableCell align="right">R$ {asset.value.toFixed(2)}</TableCell>
                <TableCell align="right" className="text-green-600 dark:text-green-400 font-medium">
                  R$ {(asset.quantity * asset.value).toFixed(2)}
                </TableCell>
                {isAdmin && (
                  <TableCell align="center">
                    <IconButton size="small" color="primary" onClick={() => { setEditingAsset(asset); setFormData({ code: asset.code, name: asset.name, quantity: asset.quantity.toString(), value: asset.value.toString() }); setOpenEditDialog(true); }}>
                      <Edit />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => { setDeletingAsset(asset); setOpenDeleteDialog(true); }}>
                      <Delete />
                    </IconButton>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {assets.length === 0 && (
              <TableRow>
                <TableCell colSpan={isAdmin ? 6 : 5} align="center" sx={{ py: 3 }}>
                  Nenhum ativo cadastrado no banco de dados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          
          {assets.length > 0 && (
            <TableFooter>
              <TableRow sx={{ backgroundColor: (theme) => theme.palette.mode === 'dark' ? '#272727' : '#f5f5f5' }}>
                <TableCell colSpan={2} align="left">
                  <Typography variant="subtitle1" fontWeight="bold">Total em Ativos</Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="subtitle1" fontWeight="bold">{totalItems}</Typography>
                </TableCell>
                <TableCell></TableCell>
                <TableCell align="right">
                  <Typography variant="subtitle1" fontWeight="bold" color="success.main">
                    R$ {totalValue.toFixed(2)}
                  </Typography>
                </TableCell>
                {isAdmin && <TableCell></TableCell>}
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </TableContainer>

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
            {/* CORREÇÃO: Removido o campo "Código do Ativo" */}
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

      {/* MODAL 4: EXCLUIR */}
      <Dialog open={openDeleteDialog} onClose={() => setOpenDeleteDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Confirmar Exclusão</DialogTitle>
        <DialogContent>
          {deletingAsset && (
            <Typography className="mt-2">
              Tem certeza que deseja excluir o ativo <strong>{deletingAsset.name}</strong>?
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenDeleteDialog(false)}>Cancelar</Button>
          <Button onClick={handleDelete} variant="contained" color="error">Excluir</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}