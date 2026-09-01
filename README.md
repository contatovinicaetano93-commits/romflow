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
- `RESEND_API_KEY` e `RESEND_FROM` — convites por e-mail
- `SESSION_SECRET` — cookie de sessão
- `APP_URL` — URL pública do app (links de convite)

```bash
npm install
npm run db:push
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). Acesso inicial: administrador Rodrigo.
