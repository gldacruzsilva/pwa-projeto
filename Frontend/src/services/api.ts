
// src/services/api.ts

const getApiUrl = () => {
  // Se houver variável de ambiente, utiliza o endereço configurado.
  const env = (import.meta as ImportMeta & {
    env?: { VITE_API_URL?: string };
  }).env;

  if (env?.VITE_API_URL) {
    return env.VITE_API_URL.replace(/\/+$/, '');
  }

  // Caso contrário, utiliza o backend local.
  const hostname = window.location.hostname;
  return `http://${hostname}:3000`;
};

export const API_URL = getApiUrl();

// Converte caminhos /api/... para as rotas reais do Backend.
export const apiUrl = (path: string) => {
  const caminho = path.startsWith('/') ? path : `/${path}`;
  const caminhoSemApi = caminho.replace(/^\/api(?=\/|$)/, '');

  return `${API_URL}${caminhoSemApi}`;
};
