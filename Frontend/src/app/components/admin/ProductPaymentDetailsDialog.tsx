import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  IconButton,
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
      icon: <AttachMoney className="text-green-600" fontSize="large" />,
      color: 'text-green-600',
    },
    {
      name: 'Débito',
      key: 'debito' as keyof PaymentMethodStat,
      icon: <CreditCard className="text-blue-600" fontSize="large" />,
      color: 'text-blue-600',
    },
    {
      name: 'Crédito',
      key: 'credito' as keyof PaymentMethodStat,
      icon: <CreditCard className="text-purple-600" fontSize="large" />,
      color: 'text-purple-600',
    },
    {
      name: 'PIX',
      key: 'pix' as keyof PaymentMethodStat,
      icon: <QrCode2 className="text-orange-600" fontSize="large" />,
      color: 'text-orange-600',
    },
  ];

  const getPercentage = (amount: number) => {
    if (totalRevenue === 0) return 0;
    return ((amount / totalRevenue) * 100).toFixed(1);
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box className="flex justify-between items-center">
          <Box>
            <Typography variant="h6">{productName}</Typography>
            <Typography variant="body2" color="text.secondary">
              Código: {productCode}
            </Typography>
          </Box>
          <IconButton onClick={onClose}>
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        <Card className="mb-4">
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              Receita Total do Produto
            </Typography>
            <Typography variant="h4" className="text-green-600">
              R$ {totalRevenue.toFixed(2)}
            </Typography>
          </CardContent>
        </Card>

        <Typography variant="h6" className="mb-3">
          Receita por Forma de Pagamento
        </Typography>

        <Grid container spacing={2}>
          {paymentMethods.map((method) => (
            <Grid item xs={6} key={method.key}>
              <Card>
                <CardContent>
                  <Box className="flex items-center justify-between mb-2">
                    {method.icon}
                    <Typography variant="caption" color="text.secondary">
                      {getPercentage(paymentStats[method.key])}%
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {method.name}
                  </Typography>
                  <Typography variant="h6" className={method.color}>
                    R$ {paymentStats[method.key].toFixed(2)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" className="block mt-1">
                    {paymentUnits[method.key].toFixed(1)} unidades
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Fechar</Button>
      </DialogActions>
    </Dialog>
  );
}
