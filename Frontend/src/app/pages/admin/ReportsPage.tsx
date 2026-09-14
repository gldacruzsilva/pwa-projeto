import { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip as MuiTooltip,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  ShoppingCart,
  AttachMoney,
  Info,
  Search,
} from '@mui/icons-material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { useOrders } from '../../contexts/OrderContext';
import ProductPaymentDetailsDialog from '../../components/admin/ProductPaymentDetailsDialog';
import { toast } from 'sonner';
import { API_URL } from '../../../services/api';

// Função para formatar a data de AAAA-MM-DD para DD/MM/AAAA no gráfico
const formatarDataBR = (dataISO: string) => {
  if (!dataISO) return '';
  const partes = dataISO.split('-');
  if (partes.length !== 3) return dataISO;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
};

// Função para formatar dinheiro no padrão brasileiro (Ex: 11.354,24)
const formatarDinheiroBR = (valor: number) => {
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

export default function ReportsPage() {
  const theme = useTheme();
  // 🟢 Hook para detectar telas de celular
  const isMobile = useMediaQuery(theme.breakpoints.down('sm')); 
  
  const { getPaymentStatsByProduct, getPaymentUnitsByProduct } = useOrders();
  
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

  const [selectedProduct, setSelectedProduct] = useState<{
    code: string;
    name: string;
    revenue: number;
  } | null>(null);

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

  const carregarRelatorios = async () => {
    try {
      // 🟢 BUSCANDO DADOS REAIS DO BACKEND
      const response = await fetch(`${API_URL}/relatorios/vendas`);
      if (!response.ok) throw new Error('Erro ao buscar comandas');
      
      const comandas = await response.json();
      if (!Array.isArray(comandas)) return;
      
      const comandasFiltradas = comandas.filter((c: any) => {
        if (!c.data_venda) return false;
        const dateStr = c.data_venda.split('T')[0]; 
        return dateStr >= startDate && dateStr <= endDate;
      });

      let receita = 0;
      comandasFiltradas.forEach((c: any) => {
        receita += Number(c.valor_total || 0);
      });
      setTotalRevenue(receita);
      setTotalOrders(comandasFiltradas.length);

      const dailyMap: Record<string, any> = {};
      comandasFiltradas.forEach((c: any) => {
        const dateStr = c.data_venda.split('T')[0];
        if (!dailyMap[dateStr]) {
          dailyMap[dateStr] = { date: dateStr, total: 0, orders: 0 };
        }
        dailyMap[dateStr].total += Number(c.valor_total || 0);
        dailyMap[dateStr].orders += 1;
      });
      setSalesData(Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date)));

      const monthlyMap: Record<string, any> = {};
      comandasFiltradas.forEach((c: any) => {
        const date = new Date(c.data_venda);
        const monthStr = date.toLocaleString('pt-BR', { month: 'short' });
        const sortKey = `${date.getFullYear()}-${date.getMonth().toString().padStart(2, '0')}`;
        
        if (!monthlyMap[monthStr]) {
          monthlyMap[monthStr] = { month: monthStr.charAt(0).toUpperCase() + monthStr.slice(1), revenue: 0, sortKey };
        }
        monthlyMap[monthStr].revenue += Number(c.valor_total || 0);
      });
      setMonthlyData(Object.values(monthlyMap).sort((a, b) => a.sortKey.localeCompare(b.sortKey)));

      try {
        const prodRes = await fetch(`${API_URL}/relatorios/produtos?inicio=${startDate}&fim=${endDate}`);
        if (prodRes.ok) {
          const prodData = await prodRes.json();
          const formatados = prodData.map((p: any) => ({
            product: p.product,
            quantity: Number(p.quantity || 0),
            revenue: Number(p.revenue || 0)
          }));
          setProductSales(formatados);
        }
      } catch (err) {
        console.warn('Erro ao buscar produtos mais vendidos do banco.');
        setProductSales([]);
      }

    } catch (error) {
      console.error(error);
      toast.error('Erro ao carregar dados do relatório. Verifique o console.');
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
        
        {/* 🟢 Campos responsivos (Empilham no celular, lado a lado no PC) */}
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 3, alignItems: { xs: 'stretch', sm: 'flex-start' } }}>
          <TextField
            label="Data Início"
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); validateDateYear(e.target.value); }}
            InputLabelProps={{ shrink: true }}
            error={!!dateError}
            fullWidth={isMobile}
            sx={{ minWidth: 200 }}
          />
          <TextField
            label="Data Fim"
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); validateDateYear(e.target.value); }}
            InputLabelProps={{ shrink: true }}
            error={!!dateError}
            helperText={dateError}
            fullWidth={isMobile}
            sx={{ minWidth: 200 }}
          />
          <Button 
            variant="contained" 
            startIcon={<Search />}
            onClick={carregarRelatorios}
            fullWidth={isMobile}
            sx={{ height: 56, minWidth: 160 }}
          >
            Aplicar Filtro
          </Button>
        </Box>
      </Paper>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 6 }}>
          <Card sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                    Receita Total (Período)
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#10b981' }}>
                    R$ {formatarDinheiroBR(totalRevenue)}
                  </Typography>
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
                  <Typography color="text.secondary" variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                    Total de Vendas / Comandas
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#3b82f6' }}>
                    {totalOrders}
                  </Typography>
                </Box>
                <ShoppingCart sx={{ color: '#3b82f6', fontSize: 48, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, borderRadius: 2 }}>
            <Typography variant="h6" sx={{ mb: 4, fontWeight: 'bold' }}>
              Receita diária
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={salesData} margin={{ top: 10, right: 30, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                <XAxis 
                  dataKey="date" 
                  stroke={theme.palette.text.secondary} 
                  tickFormatter={formatarDataBR}
                  style={{ fontSize: '12px' }} 
                />
                <YAxis 
                  stroke={theme.palette.text.secondary} 
                  tickFormatter={(value) => formatarDinheiroBR(value)} 
                  width={90} 
                  style={{ fontSize: '12px' }}
                />
                <Tooltip 
                  labelFormatter={formatarDataBR}
                  formatter={(value: number) => [`R$ ${formatarDinheiroBR(value)}`, 'Receita']}
                  contentStyle={{ backgroundColor: theme.palette.background.paper, borderColor: theme.palette.divider }}
                  itemStyle={{ color: theme.palette.text.primary }}
                />
                <Legend wrapperStyle={{ paddingTop: '10px' }} />
                <Bar dataKey="total" fill="#3b82f6" name="Receita" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, borderRadius: 2 }}>
            <Typography variant="h6" sx={{ mb: 4, fontWeight: 'bold' }}>
              Receita Mensal
            </Typography>
            {/* 🟢 Correção: Removida a duplicação do ResponsiveContainer */}
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyData} margin={{ top: 10, right: 30, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                <XAxis 
                  dataKey="month" 
                  stroke={theme.palette.text.secondary} 
                  style={{ fontSize: '12px' }}
                />
                <YAxis 
                  stroke={theme.palette.text.secondary}
                  tickFormatter={(value) => formatarDinheiroBR(value)} 
                  width={90} 
                  style={{ fontSize: '12px' }}
                />
                <Tooltip 
                  formatter={(value: number) => [`R$ ${formatarDinheiroBR(value)}`, 'Receita']}
                  contentStyle={{ backgroundColor: theme.palette.background.paper, borderColor: theme.palette.divider }}
                />
                <Legend wrapperStyle={{ paddingTop: '10px' }} />
                <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} name="Receita" dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>

      <Paper sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ mb: 3, fontWeight: 'bold' }}>
          Produtos Mais Vendidos
        </Typography>

        {/* 🟢 RENDERIZAÇÃO CONDICIONAL: CARDS NO CELULAR, TABELA NO PC */}
        {isMobile ? (
          <Box display="flex" flexDirection="column" gap={2}>
            {productSales.map((item) => (
              <Card key={item.product} variant="outlined">
                <CardContent sx={{ pb: '16px !important' }}>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                    <Typography variant="subtitle1" fontWeight="bold" lineHeight={1.2}>
                      {item.product}
                    </Typography>
                    <IconButton
                      size="small"
                      color="primary"
                      sx={{ ml: 1, mt: -0.5 }} // Ajuste fino visual
                      onClick={() =>
                        setSelectedProduct({
                          code: '7891234567890', // Mantenha a lógica do código original
                          name: item.product,
                          revenue: item.revenue,
                        })
                      }
                    >
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
                    <TableCell align="right" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                      R$ {formatarDinheiroBR(item.revenue)}
                    </TableCell>
                    <TableCell align="center">
                      <MuiTooltip title="Ver detalhes de pagamento">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() =>
                            setSelectedProduct({
                              code: '7891234567890',
                              name: item.product,
                              revenue: item.revenue,
                            })
                          }
                        >
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
          paymentStats={getPaymentStatsByProduct(selectedProduct.code)}
          paymentUnits={getPaymentUnitsByProduct(selectedProduct.code)}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </Box>
  );
}