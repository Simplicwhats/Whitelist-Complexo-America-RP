# Secrets das Edge Functions

No Supabase Dashboard → Edge Functions → Secrets (ou via CLI), configure:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (nunca no site, GitHub ou em repositório)
- `DISCORD_WL_WEBHOOK_URL` (webhook privado do canal da staff)
- `ADMIN_DISCORD_IDS` (IDs numéricos de Discord separados por vírgula)

O código de admin-update exige que o usuário autenticado via Supabase Auth tenha ID Discord presente em `ADMIN_DISCORD_IDS`.
O formulário público não exige login. O painel administrativo visual ainda precisa ser construído/implantado; esta função é a API segura para sua ação de atualização.
