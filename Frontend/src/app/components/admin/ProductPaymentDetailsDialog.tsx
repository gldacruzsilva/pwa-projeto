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
import { PaymentMethodStat, PaymentMethodUnits } from '../../contexts/OrderContext';

interface ProductPaymentDetailsDialogProps {
  productName: string;
  productCode: string;
  totalRevenue: number;
  paymentStats: PaymentMethodStat;
  paymentUnits: PaymentMethodUnits;
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
  const paymentMethods = [
    {
      name: 'Dinheiro',
      key: 'dinheiro' as keyof PaymentMethodStat,
      icon: <AttachMoney className="text-green-600" fontSize="medium" />,
      color: 'text-green-600',
    },
    {
      name: 'Débito',
      key: 'debito' as keyof PaymentMethodStat,
      icon: <CreditCard className="text-blue-600" fontSize="medium" />,
      color: 'text-blue-600',
    },
    {
      name: 'Crédito',
      key: 'credito' as keyof PaymentMethodStat,
      icon: <CreditCard className="text-purple-600" fontSize="medium" />,
      color: 'text-purple-600',
    },
    {
      name: 'PIX',
      key: 'pix' as keyof PaymentMethodStat,
      icon: <QrCode2 className="text-orange-600" fontSize="medium" />,
      color: 'text-orange-600',
    },
  ];

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
          {paymentMethods.map((method) => (
            // xs={12} para mobile (1 coluna), sm={6} para desktop (2 colunas)
            <Grid size={{ xs: 12, sm: 6 }} key={method.key}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent sx={{ p: 2, pb: '16px !important' }}>
                  <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.5}>
                    <Box display="flex" alignItems="center" gap={1}>
                      {method.icon}
                      <Typography variant="body2" fontWeight="medium" color="text.secondary">
                        {method.name}
                      </Typography>
                    </Box>
                    <Typography variant="caption" fontWeight="bold" sx={{ bgcolor: 'action.hover', px: 1, py: 0.5, borderRadius: 1 }}>
                      {getPercentage(paymentStats[method.key])}%
                    </Typography>
                  </Box>
                  
                  <Divider sx={{ mb: 1.5 }} />

                  <Typography variant="h6" fontWeight="bold" className={method.color}>
                    R$ {paymentStats[method.key].toFixed(2)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {paymentUnits[method.key].toFixed(1)} unidades vendidas
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </DialogContent>
    </Dialog>
  );
}