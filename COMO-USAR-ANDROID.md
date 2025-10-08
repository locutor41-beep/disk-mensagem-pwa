# Como usar no Android (Chrome)

**Opção A — usar sem instalar (rápido):**
1) Copie o arquivo `Disk-Mensagem-PWA.zip` para o celular e **extraia**.
2) Abra o app **Arquivos** do Android, entre na pasta extraída e toque em **cliente.html** (para clientes) ou **admin.html** (para você).
   - Abra com **Chrome**.
   - Funciona normalmente. (No modo arquivo local, recursos de "instalar como app" e offline podem não aparecer.)

**Opção B — instalar como app (recomendado):**
1) Hospede a pasta **Disk-Mensagem-PWA** em qualquer serviço com **HTTPS** (Netlify, Vercel, GitHub Pages, Cloudflare Pages, etc.).
2) No Android, abra o link hospedado no Chrome e toque no menu ⋮ → **Adicionar à tela inicial**.
   - Isso instala o app com ícone e suporte offline.

**Tempo real entre dispositivos (opcional):**
- Edite o arquivo `config.js` e preencha `supabase.url` e `supabase.anonKey` do seu projeto.
- Sem essas chaves, o app funciona **localmente** (cada dispositivo guarda seus pedidos).

**Senha do Admin:** a senha padrão é `admin123`. Você pode trocar em `config.js`.
