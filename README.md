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

Na zona DNS da Locaweb, altere só estas duas entradas:

| Entrada | Tipo | De | Para |
| --- | --- | --- | --- |
| `.` | A | `191.252.4.62` | `10.0.1.2` |
| `www` | CNAME | `romflow.com.br` | `cname.vercel-dns-0.com` |

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

Abra [http://localhost:3000](http://localhost:3000). Acesso inicial: administrador Rodrigo.
