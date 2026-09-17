import { createBrowserRouter } from "react-router";
import LoginPage from "./pages/LoginPage";
import AdminLayout from "./layouts/AdminLayout";
import EmployeeLayout from "./layouts/EmployeeLayout";
import InventoryPage from "./pages/admin/InventoryPage";
import StockReceiptPage from "./pages/admin/StockReceiptPage";
import AssetsPage from "./pages/admin/AssetsPage";
import ReportsPage from "./pages/admin/ReportsPage";
import AuditHistoryPage from "./pages/admin/AuditHistoryPage";
import SalesPage from "./pages/employee/SalesPage";
import NotFoundPage from "./pages/NotFoundPage";

// 🟢 1. Importe a tela exclusiva do funcionário que criamos!
// Ajuste o caminho './app/components/employee/StockReceiptTab' de acordo com a pasta correta do seu projeto
import StockReceiptTab from "./components/employee/StockReceiptTab"; 

export const router = createBrowserRouter([
  {
    path: "/",
    Component: LoginPage,
  },
  {
    path: "/admin",
    Component: AdminLayout,
    children: [
      { index: true, Component: InventoryPage },
      { path: "estoque", Component: InventoryPage },
      { path: "movimentacao", Component: StockReceiptPage }, // Admin usa a Page
      { path: "ativos", Component: AssetsPage },
      { path: "relatorios", Component: ReportsPage },
      { path: "auditoria", Component: AuditHistoryPage },
    ],
  },
  {
    path: "/funcionario",
    Component: EmployeeLayout,
    children: [
      { index: true, Component: SalesPage },
      { path: "comandas", Component: SalesPage },
      // 🟢 2. Agora sim, o funcionário chama a aba blindada dele (Tab)
      { path: "estoque", Component: StockReceiptTab }, 
    ],
  },
  {
    path: "*",
    Component: NotFoundPage,
  },
]);