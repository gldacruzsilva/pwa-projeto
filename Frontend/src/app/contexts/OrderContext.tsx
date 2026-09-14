import { createContext, useContext, useState, ReactNode } from 'react';

export interface Product {
  code: string;
  name: string;
  price: number;
  stock: number;
}

export interface OrderItem {
  product: Product;
  quantity: number;
}

export interface PaymentMethodStat {
  dinheiro: number;
  debito: number;
  credito: number;
  pix: number;
}

export interface PaymentMethodUnits {
  dinheiro: number;
  debito: number;
  credito: number;
  pix: number;
}

export interface Order {
  id: number;
  customerName: string;
  items: OrderItem[];
  createdAt: Date;
  totalPaid: number;
  payments: { method: string; amount: number }[];
}

interface OrderContextType {
  orders: Order[];
  products: Record<string, Product>;
  closedOrders: Order[];
  createOrder: (customerName: string) => { success: boolean; message?: string };
  addItemToOrder: (orderId: number, product: Product, quantity: number) => void;
  updateItemQuantity: (orderId: number, productCode: string, quantity: number) => void;
  removeItemFromOrder: (orderId: number, productCode: string) => void;
  addPayment: (orderId: number, amount: number, method: string) => void;
  closeOrder: (orderId: number) => void;
  deleteOrder: (orderId: number) => void;
  updateProductStock: (code: string, quantity: number) => void;
  getPaymentStatsByProduct: (productCode: string) => PaymentMethodStat;
  getPaymentUnitsByProduct: (productCode: string) => PaymentMethodUnits;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

const initialProducts: Record<string, Product> = {
  '7891234567890': { code: '7891234567890', name: 'Água Mineral 500ml', price: 3.50, stock: 48 },
  '7891234567891': { code: '7891234567891', name: 'Refrigerante Lata', price: 5.00, stock: 36 },
  '7891234567892': { code: '7891234567892', name: 'Salgado Assado', price: 7.00, stock: 24 },
  '7891234567893': { code: '7891234567893', name: 'Chocolate', price: 4.50, stock: 15 },
  '7891234567894': { code: '7891234567894', name: 'Energético', price: 8.00, stock: 20 },
  '7891234567895': { code: '7891234567895', name: 'Cerveja Lata', price: 6.00, stock: 60 },
  '7891234567896': { code: '7891234567896', name: 'Suco Natural', price: 7.50, stock: 18 },
  '7891234567897': { code: '7891234567897', name: 'Sanduíche', price: 12.00, stock: 10 },
  '7891234567898': { code: '7891234567898', name: 'Batata Frita', price: 15.00, stock: 8 },
  '7891234567899': { code: '7891234567899', name: 'Picolé', price: 5.50, stock: 25 },
};

export function OrderProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [closedOrders, setClosedOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Record<string, Product>>(initialProducts);

  const createOrder = (customerName: string) => {
    // Verificar se já existe uma comanda com o mesmo nome
    const duplicateOrder = orders.find(
      order => order.customerName.toLowerCase() === customerName.toLowerCase()
    );
    
    if (duplicateOrder) {
      return { 
        success: false, 
        message: 'Já existe uma comanda com este nome. Por favor, escolha outro nome.' 
      };
    }

    const newOrder: Order = {
      id: orders.length > 0 ? Math.max(...orders.map(o => o.id)) + 1 : 1,
      customerName,
      items: [],
      createdAt: new Date(),
      totalPaid: 0,
      payments: [],
    };
    setOrders([...orders, newOrder]);
    return { success: true };
  };

  const addItemToOrder = (orderId: number, product: Product, quantity: number) => {
    setOrders(orders.map(order => {
      if (order.id !== orderId) return order;

      const existingItem = order.items.find(item => item.product.code === product.code);

      if (existingItem) {
        return {
          ...order,
          items: order.items.map(item =>
            item.product.code === product.code
              ? { ...item, quantity: item.quantity + quantity }
              : item
          ),
        };
      } else {
        return {
          ...order,
          items: [...order.items, { product, quantity }],
        };
      }
    }));
  };

  const updateItemQuantity = (orderId: number, productCode: string, quantity: number) => {
    setOrders(orders.map(order => {
      if (order.id !== orderId) return order;

      return {
        ...order,
        items: order.items.map(item =>
          item.product.code === productCode
            ? { ...item, quantity }
            : item
        ),
      };
    }));
  };

  const removeItemFromOrder = (orderId: number, productCode: string) => {
    setOrders(orders.map(order => {
      if (order.id !== orderId) return order;

      return {
        ...order,
        items: order.items.filter(item => item.product.code !== productCode),
      };
    }));
  };

  const addPayment = (orderId: number, amount: number, method: string) => {
    setOrders(orders.map(order =>
      order.id === orderId
        ? {
            ...order,
            totalPaid: order.totalPaid + amount,
            payments: [...order.payments, { method, amount }]
          }
        : order
    ));
  };

  const closeOrder = (orderId: number) => {
    const orderToClose = orders.find(o => o.id === orderId);
    if (orderToClose) {
      setClosedOrders([...closedOrders, orderToClose]);
    }
    setOrders(orders.filter(order => order.id !== orderId));
  };

  const deleteOrder = (orderId: number) => {
    setOrders(orders.filter(order => order.id !== orderId));
  };

  const getPaymentStatsByProduct = (productCode: string): PaymentMethodStat => {
    const stats: PaymentMethodStat = {
      dinheiro: 0,
      debito: 0,
      credito: 0,
      pix: 0,
    };

    closedOrders.forEach(order => {
      const orderItem = order.items.find(item => item.product.code === productCode);
      if (!orderItem) return;

      const itemTotal = orderItem.product.price * orderItem.quantity;
      const orderTotal = order.items.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
      const itemProportion = itemTotal / orderTotal;

      order.payments.forEach(payment => {
        const itemPayment = payment.amount * itemProportion;
        const method = payment.method as keyof PaymentMethodStat;
        if (stats[method] !== undefined) {
          stats[method] += itemPayment;
        }
      });
    });

    return stats;
  };

  const getPaymentUnitsByProduct = (productCode: string): PaymentMethodUnits => {
    const units: PaymentMethodUnits = {
      dinheiro: 0,
      debito: 0,
      credito: 0,
      pix: 0,
    };

    closedOrders.forEach(order => {
      const orderItem = order.items.find(item => item.product.code === productCode);
      if (!orderItem) return;

      const itemTotal = orderItem.product.price * orderItem.quantity;
      const orderTotal = order.items.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
      const itemProportion = itemTotal / orderTotal;

      order.payments.forEach(payment => {
        const unitsForPayment = orderItem.quantity * (payment.amount / orderTotal);
        const method = payment.method as keyof PaymentMethodUnits;
        if (units[method] !== undefined) {
          units[method] += unitsForPayment;
        }
      });
    });

    return units;
  };

  const updateProductStock = (code: string, quantity: number) => {
    setProducts(prev => ({
      ...prev,
      [code]: {
        ...prev[code],
        stock: prev[code].stock + quantity,
      },
    }));
  };

  return (
    <OrderContext.Provider
      value={{
        orders,
        products,
        closedOrders,
        createOrder,
        addItemToOrder,
        updateItemQuantity,
        removeItemFromOrder,
        addPayment,
        closeOrder,
        deleteOrder,
        updateProductStock,
        getPaymentStatsByProduct,
        getPaymentUnitsByProduct,
      }}
    >
      {children}
    </OrderContext.Provider>
  );
}

export function useOrders() {
  const context = useContext(OrderContext);
  if (context === undefined) {
    throw new Error('useOrders must be used within an OrderProvider');
  }
  return context;
}