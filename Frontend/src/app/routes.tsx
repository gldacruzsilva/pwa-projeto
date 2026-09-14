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
      { path: "inventory", Component: InventoryPage },
      { path: "stock-receipt", Component: StockReceiptPage },
      { path: "assets", Component: AssetsPage },
      { path: "reports", Component: ReportsPage },
      { path: "audit", Component: AuditHistoryPage },
    ],
  },
  {
    path: "/employee",
    Component: EmployeeLayout,
    children: [
      { index: true, Component: SalesPage },
      { path: "sales", Component: SalesPage },
      // 🟢 Adicionamos a rota de estoque para o funcionário aqui:
      { path: "stock-receipt", Component: StockReceiptPage },
    ],
  },
  {
    path: "*",
    Component: NotFoundPage,
  },
]);