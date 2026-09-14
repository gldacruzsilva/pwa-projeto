import { useState } from 'react';
import { Box, Tabs, Tab, Badge } from '@mui/material';
import { Receipt, Add, Inventory } from '@mui/icons-material';
import { useOrders } from '../../contexts/OrderContext';
import OrdersListTab from '../../components/employee/OrdersListTab';
import NewOrderTab from '../../components/employee/NewOrderTab';
import StockReceiptTab from '../../components/employee/StockReceiptTab';

export default function SalesPage() {
  const [activeTab, setActiveTab] = useState(0);
  const { orders } = useOrders();

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
        {activeTab === 0 && <OrdersListTab />}
        {activeTab === 1 && <NewOrderTab onOrderCreated={() => setActiveTab(0)} />}
        {activeTab === 2 && <StockReceiptTab />}
      </Box>
    </Box>
  );
}
