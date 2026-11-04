import { useCallback, useState } from 'react';
import { Box, Tabs, Tab, Badge } from '@mui/material';
import { Receipt, Add } from '@mui/icons-material';
import { useNavigate } from 'react-router';
import { useOrders } from '../../contexts/OrderContext';
import OrdersListTab from '../../components/employee/OrdersListTab';
import NewOrderTab from '../../components/employee/NewOrderTab';

export default function SalesPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [orderToOpen, setOrderToOpen] = useState<number | null>(null);
  const { orders } = useOrders();
  const navigate = useNavigate();
  const handleOrderOpened = useCallback(() => setOrderToOpen(null), []);

  return (
    <Box className="h-full flex flex-col">
      <Box className="bg-white border-b">
        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
          <Tab
            icon={<Badge badgeContent={orders.length} color="primary"><Receipt /></Badge>}
            label="Comandas em aberto"
            iconPosition="start"
          />
          <Tab
            icon={<Add />}
            label="Nova Comanda"
            iconPosition="start"
          />
        </Tabs>
      </Box>

      <Box className="flex-1 overflow-auto">
        {activeTab === 0 && (
          <OrdersListTab
            initialOrderId={orderToOpen}
            onOrderOpened={handleOrderOpened}
            onRegisterProduct={(barcode) => navigate('/funcionario/estoque', { state: { initialBarcode: barcode } })}
          />
        )}
        {activeTab === 1 && (
          <NewOrderTab onOrderCreated={(orderId) => {
            setOrderToOpen(orderId);
            setActiveTab(0);
          }} />
        )}
      </Box>
    </Box>
  );
}
