# Deploy no Replit — Checklist

Guia passo a passo pra publicar o Open AI UGC no Replit (front + API + banco no mesmo lugar).

---

## 1. Subir o código

- [ ] Criar um Repl importando este repositório (Replit → **Create Repl → Import from GitHub**), ou subir os arquivos.
- [ ] Garantir que o `.env` **não** vai pro Repl (já está no `.gitignore`). As chaves vão nos **Secrets** do Replit (passo 4).

## 2. Banco de dados (PostgreSQL nativo do Replit)

- [ ] No Repl, abrir a aba **Database** (PostgreSQL, powered by Neon) e criar o banco.
- [ ] Copiar a connection string que ele fornece.
- [ ] Usar a mesma string em `DATABASE_URL` **e** `DIRECT_URL` (passo 4).

## 3. Gerar os segredos da aplicação

Rodar no **Shell** do Replit (ou local) e guardar os valores:

```bash
openssl rand -base64 32   # → NEXTAUTH_SECRET
openssl rand -base64 32   # → ENCRYPTION_KEY (chave-mestra do vault)
```

## 4. Configurar os Secrets (aba 🔒 Secrets do Replit)

Mínimo necessário:

| Secret | Valor |
| --- | --- |
| `DATABASE_URL` | connection string do banco (passo 2) |
| `DIRECT_URL` | mesma connection string |
| `NEXTAUTH_URL` | a URL pública do Repl (ex: `https://seu-app.replit.app`) |
| `NEXTAUTH_SECRET` | gerado no passo 3 |
| `ENCRYPTION_KEY` | gerado no passo 3 (criptografa o vault) |

> O **WEBHOOK_URL é detectado automaticamente** pela URL pública do app — não precisa configurar no Replit. (Só é usado manualmente no dev local, via ngrok.)

> As API keys (Replicate, ElevenLabs, Anthropic) ficam de fora daqui e são
> configuradas na tela **/settings** (vault). Se preferir, dá pra colocar
> `REPLICATE_API_TOKEN` / `ELEVENLABS_API_KEY` / `ANTHROPIC_API_KEY` como Secrets também (fallback).

⚠️ **`NEXTAUTH_URL` precisa ser a URL pública final do Repl.** Se ainda não souber a URL antes do primeiro deploy, faça o deploy, copie a URL gerada e atualize esse Secret.

## 5. Criar as tabelas no banco

No **Shell** do Repl, uma vez:

```bash
npm install
npx prisma db push
```

Isso cria todas as tabelas (User, Product, Avatar, Campaign, Creation, Secret, etc).

## 6. Build & Run

O Replit usa estes comandos (já configurados no `package.json`):

- **Build:** `npm run build`  (roda `prisma generate && next build`)
- **Run/Start:** `npm run start`  (já escuta em `0.0.0.0` na porta que o Replit fornece via `$PORT`)

Configurar no **Deployment** do Replit (Autoscale ou Reserved VM):
- Build command: `npm run build`
- Run command: `npm run start`

## 7. Configurar as API keys (na app, depois de no ar)

- [ ] Abrir `https://seu-app.replit.app`, criar conta (email + senha).
- [ ] Ir em **Configurações** (navbar) e colar:
  - **Replicate API Token** (obrigatório — gera vídeo/imagem)
  - **ElevenLabs API Key** (pra avatar falante)
  - **Anthropic API Key** (opcional — roteiros com Claude; sem ela usa fallback Replicate)
  - **Webhook URL**: já deve estar via Secret; pode confirmar aqui.

## 8. Teste final

- [ ] Criar um Produto + Avatar + Campanha.
- [ ] Passo 2: gerar a imagem (Nano Banana).
- [ ] Passo 3/4: gerar roteiro → voz → vídeo.
- [ ] Confirmar que o vídeo **completa** (isso prova que o webhook do Replicate alcançou `https://seu-app.replit.app/api/webhook/replicate`).

---

## Gotchas / lembretes

- **Webhook:** o Replicate precisa alcançar `WEBHOOK_URL/api/webhook/replicate` pela internet com **HTTPS**. No Replit isso é automático (URL pública). Se o vídeo nunca sai de "processando", o `WEBHOOK_URL` está errado/inacessível.
- **`NEXTAUTH_URL`** errado = login quebrado (callback não bate). Tem que ser exatamente a URL pública.
- **Trocar `ENCRYPTION_KEY` depois** invalida as chaves já salvas no vault (não dá pra descriptografar) — defina uma e mantenha.
- **Filesystem efêmero:** imagens/áudios são salvos como data URI **no banco** (não em disco), então sobrevivem a restart/redeploy. 👍
- **Stripe:** continua opcional e por env; pode ignorar.
