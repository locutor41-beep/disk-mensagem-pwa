
# Disk Mensagem Studio Neil Marcos — Admin + Cliente (MVP LOCAL + Supabase opcional)

Pronto para usar AGORA no computador. Também funciona no celular via navegador (abra o `index.html` hospedado).

## Como usar (PC)

1. Baixe e extraia este ZIP.
2. Abra a pasta `disco-mensagem-app`.
3. **Dê dois cliques em `index.html`** para abrir no seu navegador (Chrome recomendado).
4. A aba **Cliente** permite enviar pedidos.
5. A aba **Admin** (senha padrão: `admin123`) mostra os pedidos, toca som ao chegar novo pedido (modo Supabase ou quando outra aba local envia), cria/edita **Categorias & Modelos**, e altera configurações (cidade/valor/Pix).

> Dica: No modo *local*, os dados ficam apenas neste computador (localStorage). Para ver em outro computador/celular **ao mesmo tempo**, configure o Supabase (abaixo).

## Pix
- Cidade padrão: **Paraguaçu Paulista**.
- Valor nessa cidade: **R$ 70,00**.
- Outras cidades/chácaras/sítios: aparece **"Consultar"**. O app gera o **"copia e cola"** Pix e um **QR** usando a sua **Chave Pix: 18997053664**.
- O QR é gerado por um serviço de imagem público. Sem internet o QR não aparece, mas o "copia e cola" funciona.

## Modelos de mensagem (categorias)
- No Admin > *Categorias & Modelos*, crie categorias (ex.: *Amor*, *Aniversário*...) e modelos de texto.
- O cliente pode abrir os modelos no próprio app (sem baixar) e confirmar.

> Você pode **copiar/colar** o texto do Word no campo de conteúdo. (Importação direta de `.docx` pode ser adicionada depois.)

## Som ao receber novo pedido
- **Modo local:** se o Admin estiver aberto no mesmo PC (mesmo navegador ou outra aba), toca um bip.
- **Modo Supabase:** toca um bip quando um novo pedido chega de qualquer lugar (PC/celular).

## Supabase (opcional para tempo real entre dispositivos)
1. Crie um projeto grátis em supabase.com.
2. No seu projeto, abra *SQL Editor* e cole o conteúdo de `supabase_schema.sql` para criar as tabelas.
3. Em **config.js**, preencha:
   ```js
   supabase: { url: "https://xxxx.supabase.co", anonKey: "..." }
   ```
4. No painel do Supabase, ative **Realtime** para as tabelas `pedidos` (INSERT).

Pronto: quando um cliente enviar um pedido de outro dispositivo, o **Admin** aberto tocará som e mostrará o novo pedido na hora.

## Segurança
- Troque a senha do admin em `config.js` (`adminPassword`).
- Se publicar esse app na internet, proteja o Admin com autenticação séria (podemos evoluir isso).

## Celular
- Para instalar como "app" no celular, hospede estes arquivos (por exemplo, Netlify, Vercel, GitHub Pages). Depois, no navegador do celular, abra o link e use **Adicionar à tela inicial**.
- Também funciona abrindo direto pelo arquivo `index.html` no celular, mas alguns recursos (PWA/QR) exigem hospedagem.

## Limitações do MVP
- Reprodutor de música funciona melhor com links diretos de áudio (.mp3). Links de YouTube/Spotify podem abrir em nova aba para tocar.
- No modo local, não há sincronização entre dispositivos.
- Podemos empacotar versões instaláveis (Windows/Android/iOS) em uma próxima etapa usando Electron/React Native, se você quiser.

Bom trabalho e bons pedidos! 🎉
