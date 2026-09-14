import { useState, useMemo, createContext } from 'react';
import { RouterProvider } from 'react-router';
import { router } from './routes';
import { Toaster } from 'sonner';
import { OrderProvider } from './contexts/OrderContext';
import { AuditProvider } from './contexts/AuditContext';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';

// 1. Criamos um contexto para você poder acessar o botão de trocar tema em qualquer tela
export const ThemeContext = createContext({
  modo: 'light',
  alternarTema: () => {},
});

export default function App() {
  // 1. Busca do localStorage ou assume 'light' como padrão
  const [modo, setModo] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('themeMode') as 'light' | 'dark') || 'light';
  });

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: modo,
          primary: {
            main: modo === 'dark' ? '#b0bec5' : '#1976d2', 
          },
          background: {
            default: modo === 'dark' ? '#121212' : '#f5f5f5',
            paper: modo === 'dark' ? '#1e1e1e' : '#ffffff',
          },
        },
      }),
    [modo]
  );

  const alternarTema = () => {
    setModo((prev) => {
      const novoModo = prev === 'light' ? 'dark' : 'light';
      
      // 2. Salva a escolha no localStorage
      localStorage.setItem('themeMode', novoModo);

      if (novoModo === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return novoModo;
    });
  };
  
  // Restante do seu App.tsx...

  return (
    <ThemeContext.Provider value={{ modo, alternarTema }}>
      <ThemeProvider theme={theme}>
        {/* CssBaseline ajusta o fundo geral e as letras automaticamente */}
        <CssBaseline />
        <OrderProvider>
          <AuditProvider>
            <RouterProvider router={router} />
            {/* O Sonner aceita a prop theme, mudando as notificações para dark também! */}
            <Toaster position="bottom-right" richColors theme={modo} />
          </AuditProvider>
        </OrderProvider>
      </ThemeProvider>
    </ThemeContext.Provider>
  );
}