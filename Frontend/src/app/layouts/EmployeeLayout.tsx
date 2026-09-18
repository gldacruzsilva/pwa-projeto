import { useContext, useState } from 'react'; 
import { Outlet, useNavigate, useLocation } from 'react-router';
import {
  AppBar,
  Toolbar,
  Typography,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  IconButton,
  CssBaseline,
} from '@mui/material';
import { 
  Logout, 
  Brightness4, 
  Brightness7,
  Receipt,
  LocalShipping,
  Menu as MenuIcon
} from '@mui/icons-material';

import { ThemeContext } from '../App'; 

const drawerWidth = 240;

const menuItems = [
  { text: 'Comandas', icon: <Receipt />, path: 'comandas' },
  { text: 'Movimentação', icon: <LocalShipping />, path: 'estoque' }, 
];

export default function EmployeeLayout() {
  const navigate = useNavigate();
  const location = useLocation(); 
  const { modo, alternarTema } = useContext(ThemeContext);
  
  // 🟢 Estado para controlar a abertura do menu no celular
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleLogout = () => {
    navigate('/');
  };

  // 🟢 Separamos o conteúdo do menu para não repetir nos dois Drawers
  const drawerContent = (
    <>
      <Toolbar /> 
      <Box sx={{ overflow: 'auto' }}>
        <List>
          {menuItems.map((item) => (
            <ListItem key={item.text} disablePadding>
              <ListItemButton
                selected={location.pathname === item.path || location.pathname === `/funcionario/${item.path}`}
                onClick={() => {
                  navigate(item.path);
                  setMobileOpen(false); // Fecha o menu automaticamente no celular
                }}
                sx={{
                  '&.Mui-selected': {
                    backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(25, 118, 210, 0.08)',
                  }
                }}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.text} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>
    </>
  );

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <CssBaseline /> 

      <AppBar 
        position="fixed" 
        sx={{ 
          zIndex: (theme) => theme.zIndex.drawer + 1, 
          backgroundColor: (theme) => theme.palette.mode === 'dark' ? '#1e1e1e' : '#1976d2',
          boxShadow: (theme) => theme.palette.mode === 'dark' ? 'none' : 4,
          borderBottom: (theme) => theme.palette.mode === 'dark' ? '1px solid #333' : 'none',
        }}
      >
        <Toolbar>
          {/* 🟢 Ícone de Menu (Hambúrguer) visível apenas no celular */}
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>

          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Bar - Funcionário
          </Typography>
          
          <IconButton color="inherit" onClick={alternarTema} sx={{ mr: 1 }} title="Alternar tema">
            {modo === 'dark' ? <Brightness7 /> : <Brightness4 />}
          </IconButton>

          <IconButton color="inherit" onClick={handleLogout} title="Sair">
            <Logout />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        {/* 🟢 Drawer Temporário (Mobile) - Abre por cima da tela */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, 
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { 
              boxSizing: 'border-box', 
              width: drawerWidth,
              backgroundColor: (theme) => theme.palette.mode === 'dark' ? '#1e1e1e' : '#ffffff',
            },
          }}
        >
          {drawerContent}
        </Drawer>

        {/* 🟢 Drawer Permanente (Desktop) - Fica fixo do lado esquerdo */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            width: drawerWidth,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              boxSizing: 'border-box',
              backgroundColor: (theme) => theme.palette.mode === 'dark' ? '#1e1e1e' : '#ffffff',
              borderRight: (theme) => theme.palette.mode === 'dark' ? '1px solid #333' : '1px solid rgba(0, 0, 0, 0.12)',
            },
          }}
          open
        >
          {drawerContent}
        </Drawer>
      </Box>

      <Box 
        component="main" 
        sx={{ 
          flexGrow: 1, 
          p: 3, 
          width: { sm: `calc(100% - ${drawerWidth}px)` }, 
          overflowY: 'auto'
        }}
      >
        <Toolbar /> 
        <Box>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}