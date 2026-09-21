import { useState, useEffect } from 'react';
import {
  Paper, Typography, Box, Grid, Card, CardContent, TextField, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Tooltip as MuiTooltip, useTheme, useMediaQuery,
} from '@mui/material';
import {
  ShoppingCart, AttachMoney, Info, Search,
  Payments, CreditCard, QrCodeScanner
} from '@mui/icons-material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import ProductPaymentDetailsDialog from '../../components/admin/ProductPaymentDetailsDialog';
import { toast } from 'sonner';

const formatarDataBR = (dataISO: string) => {
  if (!dataISO) return '';
  const partes = dataISO.split('-');
  if (partes.length !== 3) return dataISO;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
};

const formatarDinheiroBR = (valor: number) => {
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

export default function ReportsPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm')); 
  
  const hoje = new Date();
  const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  
  const [startDate, setStartDate] = useState(primeiroDia.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(hoje.toISOString().split('T')[0]);
  const [dateError, setDateError] = useState('');
  
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [productSales, setProductSales] = useState<any[]>([]);

  // 🟢 NOVO ESTADO: Armazena o resumo global do caixa
  const [globalPaymentStats, setGlobalPaymentStats] = useState({ dinheiro: 0, debito: 0, credito: 0, pix: 0 });

  const [selectedProduct, setSelectedProduct] = useState<{ code: string; name: string; revenue: number; } | null>(null);
  const [paymentStats, setPaymentStats] = useState<any>({ dinheiro: 0, debito: 0, credito: 0, pix: 0 });
  const [paymentUnits, setPaymentUnits] = useState<any>({ dinheiro: 0, debito: 0, credito: 0, pix: 0 });

  const validateDateYear = (date: string): boolean => {
    if (!date) return true;
    const year = new Date(date).getFullYear();
    const currentYear = new Date().getFullYear();
    
    if (year < 2020) {
      setDateError('O ano deve ser igual ou superior a 2020');
      return false;
    }
    if (year > currentYear) {
      setDateError('O ano não pode ser superior ao ano atual');
      return false;
    }
    setDateError('');
    return true;
  };

  const handleViewDetails = async (item: any) => {
    try {
      const response = await fetch(`/api/relatorios/produtos/${encodeURIComponent(item.product)}/pagamentos?inicio=${startDate}&fim=${endDate}`);
      
      if (response.ok) {
        const dados = await response.json();
        const stats: Record<string, number> = {};
        const units: Record<string, number> = {};
        
        dados.forEach((d: any) => {
          stats[d.name] = Number(d.value);
          units[d.name] = Number(d.units);
        });
        
        setPaymentStats(stats);
        setPaymentUnits(units);
        setSelectedProduct({ code: item.code || 'Sistema', name: item.product, revenue: item.revenue });
      } else {
        toast.error('Nenhum detalhe de pagamento encontrado.');
      }
    } catch (erro) {
      toast.error('Erro ao buscar pagamentos do backend.');
    }
  };

  const carregarRelatorios = async () => {
    try {
      const response = await fetch(`/api/relatorios/vendas`);
      if (!response.ok) throw new Error('Erro ao buscar comandas');
      const comandas = await response.json();
      
      if (!Array.isArray(comandas)) return;
      
      const comandasFiltradas = comandas.filter((c: any) => {
        const campoData = c.data_venda || c.data || c.data_hora;
        if (!campoData) return false;
        const dateStr = campoData.toString().substring(0, 10); 
        return dateStr >= startDate && dateStr <= endDate;
      });

      let receita = 0;
      const dailyMap: Record<string, any> = {};
      const monthlyMap: Record<string, any> = {};

      comandasFiltradas.forEach((c: any) => {
        const valorComanda = Number(c.valor_total || c.total || c.valor || 0);
        receita += valorComanda;

        const campoData = c.data_venda || c.data || c.data_hora;
        const dateStr = campoData.toString().substring(0, 10);
        
        if (!dailyMap[dateStr]) {
          dailyMap[dateStr] = { date: dateStr, total: 0, orders: 0 };
        }
        dailyMap[dateStr].total += valorComanda;
        dailyMap[dateStr].orders += 1;

        const dateObj = new Date(`${dateStr}T12:00:00`); 
        const monthStr = dateObj.toLocaleString('pt-BR', { month: 'short' });
        const sortKey = `${dateObj.getFullYear()}-${dateObj.getMonth().toString().padStart(2, '0')}`;
        
        if (!monthlyMap[monthStr]) {
          monthlyMap[monthStr] = { month: monthStr.charAt(0).toUpperCase() + monthStr.slice(1), revenue: 0, sortKey };
        }
        monthlyMap[monthStr].revenue += valorComanda;
      });

      setTotalRevenue(receita);
      setTotalOrders(comandasFiltradas.length);
      setSalesData(Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date)));
      setMonthlyData(Object.values(monthlyMap).sort((a, b) => a.sortKey.localeCompare(b.sortKey)));

      try {
        const prodRes = await fetch(`/api/relatorios/produtos?inicio=${startDate}&fim=${endDate}`);
        if (prodRes.ok) {
          const prodData = await prodRes.json();
          const formatados = prodData.map((p: any) => ({
            product: p.product || p.nome || 'Produto sem nome',
            quantity: Number(p.quantity || p.qtde || 0),
            revenue: Number(p.revenue || p.valor_total || 0)
          }));
          setProductSales(formatados);
        }
      } catch (err) { setProductSales([]); }

      // 🟢 BUSCA O RESUMO DE PAGAMENTOS GERAIS PARA OS CARDS
      try {
        const pagRes = await fetch(`/api/relatorios/pagamentos?inicio=${startDate}&fim=${endDate}`);
        if (pagRes.ok) {
          const pagData = await pagRes.json();
          const stats = { dinheiro: 0, debito: 0, credito: 0, pix: 0 };
          pagData.forEach((p: any) => {
            const tipo = p.tipo_pagamento ? p.tipo_pagamento.toLowerCase() : '';
            if (tipo.includes('dinheiro')) stats.dinheiro += Number(p.total);
            else if (tipo.includes('debito') || tipo.includes('débito')) stats.debito += Number(p.total);
            else if (tipo.includes('credito') || tipo.includes('crédito')) stats.credito += Number(p.total);
            else if (tipo.includes('pix')) stats.pix += Number(p.total);
          });
          setGlobalPaymentStats(stats);
        }
      } catch (err) { console.warn('Erro ao buscar pagamentos globais'); }

    } catch (error) {
      toast.error('Erro ao carregar dados do relatório. Verifique a conexão com o banco.');
    }
  };

  useEffect(() => {
    carregarRelatorios();
  }, [startDate, endDate]);

  return (
    <Box>
      <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 4, borderRadius: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 2, color: 'text.secondary', fontWeight: 'bold' }}>
          Filtrar Período
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 3, alignItems: { xs: 'stretch', sm: 'flex-start' } }}>
          <TextField
            label="Data Início" type="date" value={startDate} InputLabelProps={{ shrink: true }} error={!!dateError}
            onChange={(e) => { setStartDate(e.target.value); validateDateYear(e.target.value); }} fullWidth={isMobile} sx={{ minWidth: 200 }}
          />
          <TextField
            label="Data Fim" type="date" value={endDate} InputLabelProps={{ shrink: true }} error={!!dateError} helperText={dateError}
            onChange={(e) => { setEndDate(e.target.value); validateDateYear(e.target.value); }} fullWidth={isMobile} sx={{ minWidth: 200 }}
          />
          <Button variant="contained" startIcon={<Search />} onClick={carregarRelatorios} fullWidth={isMobile} sx={{ height: 56, minWidth: 160 }}>
            Aplicar Filtro
          </Button>
        </Box>
      </Paper>

      {/* BLOCO 1: RESUMO MACRO */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 6 }}>
          <Card sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}> Receita Total (Período) </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#10b981' }}> R$ {formatarDinheiroBR(totalRevenue)} </Typography>
                </Box>
                <AttachMoney sx={{ color: '#10b981', fontSize: 48, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 6 }}>
          <Card sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}> Total de Vendas / Comandas </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#3b82f6' }}> {totalOrders} </Typography>
                </Box>
                <ShoppingCart sx={{ color: '#3b82f6', fontSize: 48, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 🟢 BLOCO NOVO: RESUMO GERAL DE FORMAS DE PAGAMENTO */}
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}> Fluxo de Caixa (Entradas) </Typography>
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card variant="outlined" sx={{ borderRadius: 2, borderColor: 'divider' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <Payments sx={{ color: '#10b981', fontSize: 20 }} />
                <Typography variant="body2" color="text.secondary" fontWeight="bold">Dinheiro</Typography>
              </Box>
              <Typography variant="h6" fontWeight="bold">R$ {formatarDinheiroBR(globalPaymentStats.dinheiro)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card variant="outlined" sx={{ borderRadius: 2, borderColor: 'divider' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <QrCodeScanner sx={{ color: '#06b6d4', fontSize: 20 }} />
                <Typography variant="body2" color="text.secondary" fontWeight="bold">PIX</Typography>
              </Box>
              <Typography variant="h6" fontWeight="bold">R$ {formatarDinheiroBR(globalPaymentStats.pix)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card variant="outlined" sx={{ borderRadius: 2, borderColor: 'divider' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <CreditCard sx={{ color: '#f59e0b', fontSize: 20 }} />
                <Typography variant="body2" color="text.secondary" fontWeight="bold">Débito</Typography>
              </Box>
              <Typography variant="h6" fontWeight="bold">R$ {formatarDinheiroBR(globalPaymentStats.debito)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card variant="outlined" sx={{ borderRadius: 2, borderColor: 'divider' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <CreditCard sx={{ color: '#ef4444', fontSize: 20 }} />
                <Typography variant="body2" color="text.secondary" fontWeight="bold">Crédito</Typography>
              </Box>
              <Typography variant="h6" fontWeight="bold">R$ {formatarDinheiroBR(globalPaymentStats.credito)}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* BLOCO 2: GRÁFICOS */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, borderRadius: 2 }}>
            <Typography variant="h6" sx={{ mb: 4, fontWeight: 'bold' }}> Receita diária </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={salesData} margin={{ top: 10, right: 30, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                <XAxis dataKey="date" stroke={theme.palette.text.secondary} tickFormatter={formatarDataBR} style={{ fontSize: '12px' }} />
                <YAxis stroke={theme.palette.text.secondary} tickFormatter={(value) => formatarDinheiroBR(value)} width={90} style={{ fontSize: '12px' }} />
                <Tooltip labelFormatter={formatarDataBR} formatter={(value: number) => [`R$ ${formatarDinheiroBR(value)}`, 'Receita']} contentStyle={{ backgroundColor: theme.palette.background.paper, borderColor: theme.palette.divider }} itemStyle={{ color: theme.palette.text.primary }} />
                <Legend wrapperStyle={{ paddingTop: '10px' }} />
                <Bar dataKey="total" fill="#3b82f6" name="Receita" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, borderRadius: 2 }}>
            <Typography variant="h6" sx={{ mb: 4, fontWeight: 'bold' }}> Receita Mensal </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyData} margin={{ top: 10, right: 30, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                <XAxis dataKey="month" stroke={theme.palette.text.secondary} style={{ fontSize: '12px' }} />
                <YAxis stroke={theme.palette.text.secondary} tickFormatter={(value) => formatarDinheiroBR(value)} width={90} style={{ fontSize: '12px' }} />
                <Tooltip formatter={(value: number) => [`R$ ${formatarDinheiroBR(value)}`, 'Receita']} contentStyle={{ backgroundColor: theme.palette.background.paper, borderColor: theme.palette.divider }} />
                <Legend wrapperStyle={{ paddingTop: '10px' }} />
                <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} name="Receita" dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* BLOCO 3: LISTA DE PRODUTOS MAIS VENDIDOS */}
      <Paper sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ mb: 3, fontWeight: 'bold' }}> Produtos Mais Vendidos </Typography>
        {isMobile ? (
          <Box display="flex" flexDirection="column" gap={2}>
            {productSales.map((item) => (
              <Card key={item.product} variant="outlined">
                <CardContent sx={{ pb: '16px !important' }}>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                    <Typography variant="subtitle1" fontWeight="bold" lineHeight={1.2}> {item.product} </Typography>
                    <IconButton size="small" color="primary" sx={{ ml: 1, mt: -0.5 }} onClick={() => handleViewDetails(item)}>
                      <Info />
                    </IconButton>
                  </Box>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block">Vendidos</Typography>
                      <Typography variant="body2" fontWeight="medium">{item.quantity} un</Typography>
                    </Box>
                    <Box textAlign="right">
                      <Typography variant="caption" color="text.secondary" display="block">Receita</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                        R$ {formatarDinheiroBR(item.revenue)}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            ))}
            {productSales.length === 0 && (
              <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
                Nenhum produto vendido neste período.
              </Typography>
            )}
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: (theme) => theme.palette.mode === 'dark' ? '#272727' : '#f8fafc' }}>
                  <TableCell sx={{ fontWeight: 'bold' }}>Produto</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>Quantidade Vendida</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>Receita</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold' }}>Detalhes</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {productSales.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} align="center">Nenhum produto vendido neste período.</TableCell>
                  </TableRow>
                )}
                {productSales.map((item) => (
                  <TableRow key={item.product}>
                    <TableCell>{item.product}</TableCell>
                    <TableCell align="right">{item.quantity}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold', color: 'success.main' }}> R$ {formatarDinheiroBR(item.revenue)} </TableCell>
                    <TableCell align="center">
                      <MuiTooltip title="Ver detalhes de pagamento">
                        <IconButton size="small" color="primary" onClick={() => handleViewDetails(item)}>
                          <Info />
                        </IconButton>
                      </MuiTooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

    {selectedProduct && (
        <ProductPaymentDetailsDialog
          productName={selectedProduct.name}
          productCode={selectedProduct.code}
          totalRevenue={selectedProduct.revenue}
          paymentStats={new Proxy(paymentStats, { get: (target, prop) => prop in target ? target[prop as keyof typeof target] : 0 })}
          paymentUnits={new Proxy(paymentUnits, { get: (target, prop) => prop in target ? target[prop as keyof typeof target] : 0 })}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </Box>
  );
}