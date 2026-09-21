import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  TextField,
  Alert, 
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Button,
  IconButton,
  Card,
  CardContent,
  Divider,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { ExpandMore, Delete } from '@mui/icons-material';
import { toast } from 'sonner';

interface RegistroAuditoria {
  codse: number;
  qtde: number;
  estoque_anterior?: number | string;
  data: string; 
  descricao: string;
  codp: number;
  produto_nome: string;
  codu: number;
  usuario_nome: string;
  usuario_tipo: string;
  tipo_auditoria: string; 
  lote?: string; 
}

export default function AuditHistoryPage() {
  const [auditRecords, setAuditRecords] = useState<RegistroAuditoria[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState('');

  // 🟢 Hooks para detectar celular
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md')); // Usa 'md' pois 8 colunas exigem bastante espaço

  const buscarAuditoria = async () => {
    try {
      const [resEstoque, resAtivos] = await Promise.all([
        fetch('/api/auditoria/estoque').catch(() => null),
        fetch('/api/auditoria/ativos').catch(() => null)
      ]);

      let dadosCompletos: RegistroAuditoria[] = [];

      if (resEstoque && resEstoque.ok) {
        const dadosEstoque = await resEstoque.json();
        const formatadosEstoque = dadosEstoque.map((d: any) => ({
          ...d, tipo_auditoria: d.tipo_auditoria || 'estoque'
        }));
        dadosCompletos = [...dadosCompletos, ...formatadosEstoque];
      }

      if (resAtivos && resAtivos.ok) {
        const dadosAtivos = await resAtivos.json();
        const formatadosAtivos = dadosAtivos.map((d: any) => ({
          ...d, tipo_auditoria: d.tipo_auditoria || 'ativo'
        }));
        dadosCompletos = [...dadosCompletos, ...formatadosAtivos];
      }

      const dadosUnicos = Array.from(new Map(dadosCompletos.map(item => 
        [`${item.tipo_auditoria}-${item.codse}`, item]
      )).values());

      const ordenadoCrescente = dadosUnicos.sort((a, b) => {
        const dataA = new Date(a.data || 0).getTime();
        const dataB = new Date(b.data || 0).getTime();
        if (dataA !== dataB) return dataA - dataB;
        return a.codse - b.codse;
      });

      const ultimoEstoque: Record<string, number> = {};
      const dadosComEstoqueAnterior = ordenadoCrescente.map(record => {
        const key = `${record.tipo_auditoria}-${record.codp}-${record.lote || '1'}`;
        const anterior = ultimoEstoque[key] !== undefined ? ultimoEstoque[key] : '-';
        ultimoEstoque[key] = record.qtde;
        
        return { ...record, estoque_anterior: anterior };
      });

      setAuditRecords(dadosComEstoqueAnterior.reverse());
    } catch (erro) { toast.error('Erro de conexão com o servidor Node.js.'); }
  };

  useEffect(() => { buscarAuditoria(); }, []);

  const handleDeleteRecord = async (codse: number, tipo_auditoria: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este registro?')) return;
    try {
      const resposta = await fetch(`/api/auditoria/estoque/${tipo_auditoria}/${codse}`, { method: 'DELETE' });
      if (resposta.ok) {
        toast.success('Registro excluído com sucesso!');
        buscarAuditoria(); 
      } else { toast.error('Erro ao excluir o registro.'); }
    } catch (erro) { toast.error('Erro de conexão ao tentar excluir.'); }
  };

  const handleClearHistory = async () => {
    if (!window.confirm('ATENÇÃO: Isso apagará TODO o histórico de auditoria. Deseja continuar?')) return;
    try {
      const resposta = await fetch('/api/auditoria/estoque', { method: 'DELETE' });
      if (resposta.ok) {
        toast.success('Histórico limpo com sucesso!');
        setAuditRecords([]);
      } else { toast.error('Erro ao limpar o histórico.'); }
    } catch (erro) { toast.error('Erro de conexão.'); }
  };

  const filteredRecords = auditRecords.filter(record => {
    const searchLower = searchTerm.toLowerCase();
    const nomeProduto = record.produto_nome ? record.produto_nome.toLowerCase() : '';
    const nomeUsuario = record.usuario_nome ? record.usuario_nome.toLowerCase() : '';
    const codigoProd = record.codp ? record.codp.toString() : '';
    const loteProd = record.lote ? record.lote.toLowerCase() : '';

    const matchesSearch = nomeProduto.includes(searchLower) || nomeUsuario.includes(searchLower) || codigoProd.includes(searchLower) || loteProd.includes(searchLower);
    const dataRegistro = record.data ? record.data.split('T')[0] : '';
    const matchesDate = selectedDate ? dataRegistro === selectedDate : true;
    return matchesSearch && matchesDate;
  });

  const getRoleLabel = (role: string) => role?.toLowerCase() === 'admin' ? 'Administrador' : 'Funcionário';
  const formatarData = (dataString: string) => dataString ? new Date(dataString).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

  return (
    <Box>
      

      <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 4, borderRadius: 2 }}>
        {/* 🟢 FlexBox para empilhar os filtros no celular */}
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
          <TextField 
            fullWidth 
            label="Buscar por Produto, Lote, Código ou Usuário" 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            placeholder="Digite para filtrar..." 
            sx={{ flexGrow: 1 }}
          />
          <TextField 
            fullWidth={isMobile}
            label="Filtrar por Data Específica" 
            type="date" 
            value={selectedDate} 
            onChange={(e) => setSelectedDate(e.target.value)} 
            InputLabelProps={{ shrink: true }} 
            sx={{ minWidth: { md: 250 } }}
          />
        </Box>
      </Paper>

      {filteredRecords.length === 0 ? (
        <Alert severity="info">Nenhum registro encontrado para os filtros selecionados.</Alert>
      ) : (
        <>
          {/* 🟢 RENDERIZAÇÃO CONDICIONAL: CARDS (Mobile) vs TABELA (Desktop) */}
          {isMobile ? (
            <Box display="flex" flexDirection="column" gap={2}>
              {filteredRecords.map((record, index) => (
                <Card key={`${record.tipo_auditoria}-${record.codse}-${index}`} variant="outlined">
                  <CardContent sx={{ pb: '16px !important' }}>
                    
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
                      <Typography variant="body2" fontWeight="bold" color="text.secondary">
                        {formatarData(record.data)}
                      </Typography>
                      <IconButton size="small" color="error" sx={{ mt: -0.5, mr: -1 }} onClick={() => handleDeleteRecord(record.codse, record.tipo_auditoria)}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </Box>

                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                      <Box>
                        <Typography variant="subtitle1" fontWeight="bold" lineHeight={1.2}>
                          {record.produto_nome || 'Item Excluído'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                          Cód: {record.codp} {record.tipo_auditoria === 'estoque' && `| Lote: ${record.lote || '1'}`}
                        </Typography>
                      </Box>
                      <Chip 
                        label={record.tipo_auditoria === 'ativo' ? 'Ativo' : 'Produto'} 
                        size="small" 
                        color={record.tipo_auditoria === 'ativo' ? 'secondary' : 'info'} 
                        variant="filled" 
                      />
                    </Box>

                    <Divider sx={{ my: 1.5 }} />

                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
                      <Box>
                        <Typography variant="caption" color="text.secondary" display="block">Usuário</Typography>
                        <Typography variant="body2" fontWeight="medium">{record.usuario_nome || 'Sistema'}</Typography>
                      </Box>
                      <Box textAlign="right">
                        <Typography variant="caption" color="text.secondary" display="block">Perfil</Typography>
                        <Typography variant="body2">{getRoleLabel(record.usuario_tipo)}</Typography>
                      </Box>
                    </Box>

                    <Box sx={{ bgcolor: (theme) => theme.palette.mode === 'dark' ? '#272727' : '#f8fafc', p: 1.5, borderRadius: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box>
                        <Typography variant="caption" color="text.secondary" display="block">Saldo Anterior</Typography>
                        <Typography variant="body1" fontWeight="medium">{record.estoque_anterior}</Typography>
                      </Box>
                      <Box textAlign="right">
                        <Typography variant="caption" color="text.secondary" display="block">Novo Saldo</Typography>
                        <Typography variant="body1" fontWeight="bold" color="primary">{record.qtde}</Typography>
                      </Box>
                    </Box>

                    {/* Acordeão de detalhes embutido no card */}
                    <Box mt={1}>
                      {record.descricao && record.descricao !== 'Sem descrição' ? (
                        <Accordion elevation={0} sx={{ '&:before': { display: 'none' }, bgcolor: 'transparent' }}>
                          <AccordionSummary expandIcon={<ExpandMore />} sx={{ minHeight: 'auto', p: 0, m: 0, '& .MuiAccordionSummary-content': { m: 0 } }}>
                            <Typography variant="caption" color="primary" sx={{ cursor: 'pointer' }}>Ver observação da auditoria</Typography>
                          </AccordionSummary>
                          <AccordionDetails sx={{ p: 0, pt: 1 }}>
                            <Typography variant="caption" display="block" sx={{ bgcolor: (theme) => theme.palette.mode === 'dark' ? '#1e1e1e' : '#f1f5f9', p: 1.5, borderRadius: 1, fontStyle: 'italic' }}>
                              {record.descricao}
                            </Typography>
                          </AccordionDetails>
                        </Accordion>
                      ) : (
                        <Typography variant="caption" color="text.secondary">Sem observações</Typography>
                      )}
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
                    <TableCell>Data</TableCell><TableCell>Usuário</TableCell><TableCell>Categoria</TableCell>
                    <TableCell>Item Movimentado</TableCell><TableCell align="right">Saldo Anterior</TableCell>
                    <TableCell align="right">Novo Saldo</TableCell><TableCell align="left">Detalhes</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredRecords.map((record, index) => (
                    <TableRow key={`${record.tipo_auditoria}-${record.codse}-${index}`}>
                      <TableCell><Typography variant="body2" fontWeight="bold">{formatarData(record.data)}</Typography></TableCell>
                      <TableCell>
                        <Typography variant="body2">{record.usuario_nome || 'Sistema'}</Typography>
                        <Typography variant="caption" color="text.secondary">{getRoleLabel(record.usuario_tipo)}</Typography>
                      </TableCell>
                      <TableCell><Chip label={record.tipo_auditoria === 'ativo' ? 'Ativo' : 'Produto'} size="small" color={record.tipo_auditoria === 'ativo' ? 'secondary' : 'info'} variant="filled" /></TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">{record.produto_nome || 'Item Excluído'}</Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Cód: {record.codp} {record.tipo_auditoria === 'estoque' && `| Lote: ${record.lote || '1'}`}
                        </Typography>
                      </TableCell>
                      <TableCell align="right"><Typography variant="body2" color="text.secondary">{record.estoque_anterior}</Typography></TableCell>
                      <TableCell align="right"><Typography variant="body1" fontWeight="bold" color="primary">{record.qtde}</Typography></TableCell>
                      <TableCell>
          {record.descricao && record.descricao !== 'Sem descrição' ? (
            <Accordion 
              elevation={0} 
              sx={{ 
                '&:before': { display: 'none' }, 
                bgcolor: 'transparent' 
              }}
            >
              <AccordionSummary 
                expandIcon={<ExpandMore />} 
                sx={{ 
                  minHeight: 'auto', 
                  p: 0, 
                  m: 0, 
                  // 1. Alinha o conteúdo e o ícone juntos à esquerda
                  justifyContent: 'flex-start',
                  '& .MuiAccordionSummary-content': { 
                    m: 0,
                    flexGrow: 0 // Impede que o texto ocupe todo o espaço e empurre a seta
                  },
                  '& .MuiAccordionSummary-expandIconWrapper': {
                    ml: 0.5 // Espaçamento pequeno entre o texto e a seta
                  }
                }}
              >
                <Typography variant="caption" color="primary" sx={{ cursor: 'pointer' }}>
                  Ver observação
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 0, pt: 1 }}>
                <Typography 
                  variant="caption" 
                  display="block" 
                  sx={{ 
                    bgcolor: (theme) => theme.palette.mode === 'dark' ? '#272727' : '#f1f5f9', 
                    p: 1, 
                    borderRadius: 1 
                  }}
                >
                  {record.descricao}
                </Typography>
              </AccordionDetails>
            </Accordion>
          ) : (
            <Typography variant="caption" color="text.secondary">Sem observações</Typography>
          )}
        </TableCell>
                      
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}
    </Box>
  );
}