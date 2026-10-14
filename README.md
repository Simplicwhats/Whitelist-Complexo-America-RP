# Complexo America RP — Whitelist

Projeto inicial funcional para GitHub Pages + Supabase, com formulário público sem login, pontuação automática no servidor, código privado para acompanhar status, regras, registro de histórico e notificação por webhook do Discord.

## O que vem neste pacote

- `index.html` — site público responsivo.
- `assets/css/style.css` — tema cinematográfico escuro com acentos vermelhos.
- `assets/js/config.js` — configuração pública do Supabase e convite Discord.
- `assets/js/app.js` — etapas do formulário, validação, envio, consulta de status e UX.
- `supabase/schema.sql` — tabelas privadas, RLS, histórico e função de pontuação.
- `supabase/functions/submit-wl` — validação e pontuação no servidor.
- `supabase/functions/wl-status` — consulta por código hash, sem expor a lista de candidatos.
- `supabase/functions/discord-notify` — notificação em webhook privado.
- `supabase/functions/admin-update` — endpoint de atualização de status com allowlist de IDs Discord.

## 1. Criar o Supabase

1. Crie um projeto em https://supabase.com.
2. Abra SQL Editor e execute `supabase/schema.sql`.
3. Em Project Settings → API, copie Project URL e a chave `anon`/publishable.
4. Edite `assets/js/config.js` e preencha `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `DISCORD_INVITE_URL`.
5. A chave anon é pública e pode ficar no frontend; **nunca** coloque `service_role` no site.

## 2. Publicar Edge Functions

Instale o Supabase CLI no seu computador e faça login:

```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase functions deploy submit-wl
supabase functions deploy wl-status
supabase functions deploy discord-notify
supabase functions deploy admin-update
```

Configure os segredos no projeto (não os comite no Git):

```bash
supabase secrets set SUPABASE_URL="https://SEU-PROJETO.supabase.co"
supabase secrets set SUPABASE_ANON_KEY="SUA_CHAVE_ANON"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="SUA_SERVICE_ROLE"
supabase secrets set DISCORD_WL_WEBHOOK_URL="https://discord.com/api/webhooks/..."
supabase secrets set ADMIN_DISCORD_IDS="ID_DISCORD_STAFF_1,ID_DISCORD_STAFF_2"
```

Se a sua versão do CLI exigir arquivo de configuração, inicialize com `supabase init` e coloque as pastas de função em `supabase/functions/`.

## 3. Configurar notificações do Discord

1. No Discord, crie um canal privado para a staff.
2. Em Editar canal → Integrações → Webhooks, crie um webhook e copie a URL.
3. Salve a URL apenas como segredo `DISCORD_WL_WEBHOOK_URL` no Supabase.
4. Nunca publique essa URL em JavaScript, HTML, GitHub ou prints. Se ela vazar, exclua o webhook e crie outro.

A função `submit-wl` chama `discord-notify` no servidor após salvar uma inscrição. A notificação não bloqueia a inscrição se o Discord estiver indisponível.

## 4. Configurar login da staff (somente para ações administrativas)

O candidato não precisa de login. Para o endpoint `admin-update`, a equipe precisa de uma sessão autenticada do Supabase vinculada ao Discord e o ID numérico precisa estar em `ADMIN_DISCORD_IDS`.

No Supabase:
1. Authentication → Providers → habilite Discord.
2. No Discord Developer Portal, crie uma aplicação OAuth.
3. Configure o Client ID e Client Secret no provedor Discord do Supabase (o segredo fica no Supabase, nunca no frontend).
4. Cadastre o callback OAuth indicado pelo painel Supabase em Redirects no Discord Developer Portal.
5. Em Authentication → URL Configuration, configure as URLs de retorno permitidas do seu site.
6. Publique a função `admin-update` e mantenha `ADMIN_DISCORD_IDS` restrito aos IDs de staff.

**Importante:** este pacote entrega o endpoint seguro de decisão, mas não inclui ainda uma interface administrativa completa. Não use a tabela diretamente pelo navegador; crie um painel protegido que use login Discord e chame `admin-update` com a sessão válida.

## 5. Publicar no GitHub Pages

1. Crie um repositório, por exemplo `complexo-america-wl`.
2. Envie todos os arquivos mantendo a estrutura de pastas.
3. Vá em Settings → Pages → Build and deployment → Deploy from a branch.
4. Escolha `main` e `/ (root)` e salve.
5. Aguarde o endereço `https://SEU-USUARIO.github.io/complexo-america-wl/`.
6. Se usar domínio próprio, configure-o em Pages e atualize as URLs de retorno permitidas do Supabase.

O site é estático, então GitHub Pages é adequado. Não há segredos de servidor no repositório.

## 6. Como funciona a pontuação

A pontuação é calculada novamente no servidor, não confiando em um valor enviado pelo navegador:
- 20 pontos por cada resposta correta nas quatro questões objetivas (80 no total).
- Até 10 pontos pela história do personagem.
- Até 10 pontos pela motivação.
- Máximo: 100 pontos.

O status inicial fica como `pending` (em análise). A pontuação não aprova automaticamente por padrão: ela fornece um critério para a equipe decidir. Se quiser aprovação automática por nota de corte, defina com cuidado a regra antes de ativá-la.

## 7. Status e código de acompanhamento

O formulário cria um código `CA-...`, guarda no banco apenas o hash SHA-256 e mostra o código uma vez ao candidato. O candidato precisa guardar esse código. A função `wl-status` devolve apenas pontuação, status, nota pública e data de atualização; ela não expõe nome, respostas ou dados pessoais.

## 8. Segurança antes de abrir ao público

- Não coloque `service_role`, client secret, token de bot ou webhook no frontend.
- RLS habilitada e sem policies públicas nas tabelas.
- Edge Functions validam campos e calculam a pontuação no servidor.
- Use captcha/Turnstile e rate limiting antes de divulgar o site amplamente; sem isso, um atacante pode automatizar envios.
- Defina prazo de retenção e aviso de privacidade para dados pessoais.
- Limite o acesso do Discord webhook a um canal privado.
- Faça backups regulares e teste restauração.
- Revise as regras, idade mínima, perguntas e política de aprovação com a administração.
- Teste com dados fictícios antes de receber inscrições reais.

## 9. Limitações desta primeira versão

- A página pública, formulário, consulta por código e APIs estão implementados.
- A página de regras contém textos-base e precisa ser adaptada às regras oficiais.
- O histórico é gravado para eventos de inscrição e atualização administrativa.
- A entrevista está representada por status `interview` e tabela `wl_interviews`; o fluxo de agendamento/calendário ainda precisa de uma interface de staff.
- O painel de administração completo não está incluído nesta entrega; o endpoint seguro de atualização está incluído para integrar nele.
- Para uso de produção, recomendamos acrescentar CAPTCHA, limites de requisições e logs de auditoria sem armazenar dados excessivos.
