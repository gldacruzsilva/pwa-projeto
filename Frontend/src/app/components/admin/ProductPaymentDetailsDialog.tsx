import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  IconButton,
  Divider,
} from '@mui/material';
import { Close, AttachMoney, CreditCard, QrCode2 } from '@mui/icons-material';

interface ProductPaymentDetailsDialogProps {
  productName: string;
  productCode: string;
  totalRevenue: number;
  paymentStats: Record<string, number>;
  paymentUnits: Record<string, number>;
  onClose: () => void;
}

export default function ProductPaymentDetailsDialog({
  productName,
  productCode,
  totalRevenue,
  paymentStats,
  paymentUnits,
  onClose,
}: ProductPaymentDetailsDialogProps) {
  const getPercentage = (amount: number) => {
    if (totalRevenue === 0) return 0;
    return ((amount / totalRevenue) * 100).toFixed(1);
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      {/* Botão de Fechar Customizado */}
      <IconButton
        aria-label="close"
        onClick={onClose}
        sx={{
          position: 'absolute',
          right: 16,
          top: 16,
          backgroundColor: '#ef4444',
          color: 'white',
          width: 32,
          height: 32,
          zIndex: 10,
          '&:hover': {
            backgroundColor: '#dc2626',
          },
        }}
      >
        <Close fontSize="small" />
      </IconButton>

      {/* Título - Com padding à direita para não encostar no botão de fechar */}
      <DialogTitle sx={{ pr: 7, pb: 1.5 }}>
        <Typography variant="h6" fontWeight="bold" lineHeight={1.2}>
          {productName}
        </Typography>
        
      </DialogTitle>

      <DialogContent dividers sx={{ p: { xs: 2, sm: 3 } }}>
        {/* Cartão de Receita Total */}
        <Card variant="outlined" sx={{ mb: 3, bgcolor: (theme) => theme.palette.mode === 'dark' ? '#1e1e1e' : '#f8fafc' }}>
          <CardContent sx={{ pb: '16px !important', textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary" textTransform="lowercasse" fontWeight="medium" gutterBottom>
              Receita Total do Produto
            </Typography>
            <Typography variant="h4" fontWeight="bold" className="text-green-600">
              R$ {totalRevenue.toFixed(2)}
            </Typography>
          </CardContent>
        </Card>

        {/* Grid de Métodos de Pagamento */}
        <Grid container spacing={2}>
          {Object.entries(paymentStats).map(([method, amount]) => {
            const normalizedMethod = method.toLocaleLowerCase('pt-BR');
            const icon = normalizedMethod.includes('dinheiro')
              ? <AttachMoney className="text-green-600" fontSize="medium" />
              : normalizedMethod.includes('pix')
                ? <QrCode2 className="text-orange-600" fontSize="medium" />
                : <CreditCard className="text-blue-600" fontSize="medium" />;
            const units = paymentUnits[method] ?? 0;

            return (
            // xs={12} para mobile (1 coluna), sm={6} para desktop (2 colunas)
            <Grid size={{ xs: 12, sm: 6 }} key={method}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent sx={{ p: 2, pb: '16px !important' }}>
                  <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.5}>
                    <Box display="flex" alignItems="center" gap={1}>
                      {icon}
                      <Typography variant="body2" fontWeight="medium" color="text.secondary">
                        {method}
                      </Typography>
                    </Box>
                    <Typography variant="caption" fontWeight="bold" sx={{ bgcolor: 'action.hover', px: 1, py: 0.5, borderRadius: 1 }}>
                      {getPercentage(amount)}%
                    </Typography>
                  </Box>
                  
                  <Divider sx={{ mb: 1.5 }} />

                  <Typography variant="h6" fontWeight="bold" className={normalizedMethod.includes('dinheiro') ? 'text-green-600' : 'text-blue-600'}>
                    R$ {amount.toFixed(2)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {units.toFixed(1)} unidades vendidas
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            );
          })}
        </Grid>
      </DialogContent>
    </Dialog>
  );
}