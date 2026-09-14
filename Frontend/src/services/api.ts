// src/services/api.ts
const getApiUrl = () => {
  // Se houver variável de ambiente, usa ela
  const env = (import.meta as ImportMeta & {
    env?: { VITE_API_URL?: string };
  }).env;

  if (env?.VITE_API_URL) {
    return env.VITE_API_URL;
  }

  // Se não, pega automaticamente o IP da barra de endereços do navegador do celular/computador!
  const hostname = window.location.hostname; 
  return `http://${hostname}:3000`;
};

export const API_URL = getApiUrl();