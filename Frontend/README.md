
  # Sistema de Gestão para Campo Society

Este projeto é composto por duas partes:

- Backend: responsável pela API, autenticação e acesso ao banco de dados
- Frontend: interface web do sistema

Abaixo está o passo a passo completo para rodar o projeto corretamente.

---

## 1) Pré-requisitos

Antes de começar, certifique-se de ter instalado no computador:

- Node.js
- npm
- MySQL (ou um servidor local com banco MySQL como XAMPP/WAMP/MAMP)
- Git (opcional, mas útil)

Também é necessário que o banco do projeto esteja configurado e acessível. No backend, o arquivo `.env` já contém as informações de conexão do banco:
Caso o arquivo .env não esteja aparecendo, será necessário criar um arquivo .env dentro da pasta do backend e colocar as informações necessárias.

```env
DB_HOST=localhost
DB_USER=root
DB_PASS="senha_do_banco"
DB_NAME=banco_campo
```

> Verifique se a senha e o nome do banco estão corretos no seu ambiente antes de iniciar o backend.

---

## 2) Abrir o projeto

Abra um terminal novo no vscode, caso o powershell não funcione use o command prompt, no terminal deverá abrir a pasta do projeto. Vai ficar algo assim:

```bash
cd pwa-projeto
```

---

## 3) Rodar o Backend

### 3.1 Entrar na pasta do backend

No terminal, dentro da pasta do projeto, deve abrir a pasta do backend, digite:

```bash
cd Backend
```

### 3.2 Instalar as dependências do backend

Dentro da pasta `Backend`, execute:

```bash
npm install
```

Esse comando instala todas as bibliotecas necessárias do backend, como Express, CORS, dotenv e mysql2.

### 3.3 Iniciar o backend

Depois que a instalação terminar, rode:

```bash
node app.js
```

Se tudo estiver correto, o backend deve iniciar e mostrar algo como:

```bash
🚀 Servidor rodando na porta 3000 e aceitando conexões externas!
```

> Importante: esse comando deve ser executado no terminal da pasta `Backend`.
> O backend fica acessível na porta `3000`.

---

## 4) Rodar o Frontend

Agora abra outra janela de terminal, porque o backend e o frontend precisam ficar rodando ao mesmo tempo. 
Recomendamos abrir um temrinal command prompt.

### 4.1 Entrar na pasta do frontend

No novo terminal, já dentro da mesma pasta do projeto, que deve ser algo como 'pwa-projeto', deve entrar na pasta do frontend, digite o seguinte:

```bash
cd Frontend
```

### 4.2 Instalar as dependências do frontend

Dentro da pasta `Frontend`, rode:

```bash
npm install
```

Esse comando instala as dependências do React/Vite e outros pacotes do projeto.

### 4.3 Iniciar o frontend

Depois que as dependências forem instaladas, execute:

```bash
npm run dev
```

O Vite irá iniciar o projeto e geralmente mostrará uma mensagem semelhante a:

```bash
Local: http://localhost:5173/
```

> Importante: esse comando deve ser executado no terminal da pasta `Frontend`.
> O frontend geralmente roda na porta `5173`.

---

## 5) Acessar a aplicação

Com o backend e o frontend rodando, abra o navegador e acesse:

```text
http://localhost:5173/
```

Se o backend estiver funcionando corretamente, a aplicação conseguirá se conectar à API na porta `3000`.

---



## 6) Resumo dos comandos

### Backend

```bash
cd c:pwa-projeto\Backend
npm install
node app.js
```

### Frontend

```bash
cd c:\pwa-projeto\Frontend
npm install
npm run dev
```

---

## 7) Dicas importantes

- Use dois terminais abertos ao mesmo tempo: um para o backend e outro para o frontend.
- O backend precisa do banco MySQL rodando antes de iniciar.
- Certifique-se de que o arquivo `.env` do backend está correto.
- Se aparecer erro de conexão com o banco, verifique:
  - se o MySQL está ativo;
  - se o nome do banco está correto;
  - se a senha do usuário `root` está correta;
  - se o `DB_HOST` está definido como `localhost`.

---

## 8) Caso queira reiniciar o projeto

Se precisar parar e rodar novamente:

1. Feche os processos com `Ctrl + C` nos terminais.
2. Rode o backend novamente com:

```bash
cd Backend
node app.js
```

3. Rode o frontend novamente com:

```bash
cd Frontend
npm run dev
```

---

## 9) Estrutura rápida do projeto

```text
pwa-projeto/
├── Backend/
│   ├── app.js
│   ├── banco.js
│   ├── .env
│   └── package.json
├── Frontend/
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
└── Banco de dados/
```
 
 ## 10) Primeiros passos para conseguir logar e usar a aplicação.

 Nosso projeto consta com o 'admin' e 'funcionario' sendo pré definidos, então após conseguir abrir a aplicação e cair na tela de login, é preciso criar 2 usuarios, o admin e o funcionario, as credencias pré definidas são, faça na seguinte ordem:
 Para admin: codu= 1 ; usuario= admin ; senha= 001admin ; tipo= admin ; 
 Para funcionario: codu = 2 ; usuario= funcionario ; senha= func123 ; tipo = funcionario ;
