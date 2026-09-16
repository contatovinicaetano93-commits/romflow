# ROM FLOW

Fluxo de despesas corporativo do Grupo ROM: solicitações, aprovações, pagamentos, governança e auditoria.

Empresas do grupo:

- Baru Bistro Brasil
- Baru Bistro Iguatemi
- Rom Academy
- Rom Concept Brasil
- Rom Concept Iguatemi

## Ambiente

Copie `.env.example` para `.env.local` e preencha:

- `DATABASE_URL` — Neon (pooled)
- `DATABASE_URL_UNPOOLED` — Neon (direct, para `npm run db:push`)
- `ROMFLOWBLOB_STORE_ID` — ID do Blob store privado (OIDC na Vercel). Comprovantes e recibos não ficam públicos. No dashboard da Vercel: Storage → Blob → conectar o store `ROMFLOWBLOB` ao projeto `romflow` com o prefixo `ROMFLOWBLOB` (Production, Preview e Development).
- `BLOB_READ_WRITE_TOKEN` — fallback fora da Vercel; localmente rode `npx vercel env pull .env.local --yes`
- `RESEND_API_KEY` e `RESEND_FROM` — e-mails de convite e de movimentação (`ROM Flow <noreply@romconcept.com.br>`)
- `SESSION_SECRET` — cookie de sessão
- `APP_URL` — URL pública do app (links de convite). Em produção: `https://romflow.com.br`

## Domínio `romflow.com.br`

O DNS permanece na Locaweb para não quebrar o e-mail. Não altere NS, MX, SPF, DMARC nem os CNAMEs de correio (`mail`, `smtp`, `pop`, `imap`, `pop3`, `autodiscover`, `webmail`, etc.).

Na Vercel: projeto **romflow** → Settings → Domains → adicionar `romflow.com.br` e `www.romflow.com.br` (redirecionar `www` para o apex).

Na zona DNS da Locaweb, altere só estas duas entradas (valores do card do projeto na Vercel):

| Entrada | Tipo | De | Para |
| --- | --- | --- | --- |
| `.` | A | `191.252.4.62` | `216.150.1.1` |
| `www` | CNAME | `romflow.com.br` | `32ec7df72e97c27f.vercel-dns-016.com` |

Se a Locaweb recusar o CNAME como “url válida”, deixe `www` apontando para `romflow.com.br` e mude só o A.

Manter:

- MX: `10 mx.core.locaweb.com.br`, `20 mx.a.locaweb.com.br`, `20 mx.b.locaweb.com.br`, `20 mx.jk.locaweb.com.br`
- TXT apex: `v=spf1 include:_spf.locaweb.com.br -all`
- TXT `_dmarc`: `v=DMARC1; p=none;`
- NS: `ns1/ns2/ns3.locaweb.com.br`

```bash
npm install
npm run db:push
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). Se o banco estiver vazio, a tela inicial pede o cadastro do primeiro master. Não existe senha `demo` no seed.

## Checklist para a equipe usar em produção

Confirme na Vercel (Production) antes de convocar o time:

1. `APP_URL=https://romflow.com.br`
2. `SESSION_SECRET` com pelo menos 16 caracteres
3. `DATABASE_URL` (Neon)
4. `RESEND_API_KEY` e `RESEND_FROM=ROM Flow <noreply@romconcept.com.br>`
5. Store Blob `ROMFLOWBLOB` conectado ao projeto (`ROMFLOWBLOB_STORE_ID`)
6. Domínio `romflow.com.br` com HTTPS válido

Primeiro acesso: um master já cadastrado convida o restante em **Usuários**. Convites inativos/desativados devem ser reativados na lista, não reconvidados pelo mesmo e-mail.

Ainda fora deste recorte (próximas melhorias): recuperação de senha, rate limit compartilhado (Redis), valor monetário em `numeric` em vez de `doublePrecision`, desativar empresa via API, 2FA e sessão revogável antes de 30 dias.
