# Complexo America RP — Whitelist automática

Projeto para GitHub Pages + Supabase. O candidato não precisa criar conta: responde 10 questões objetivas e recebe aprovação automática se acertar pelo menos 8 (80%). A equipe entra no painel administrativo com e-mail e senha do Supabase Auth e pode abrir cada inscrição para ler os dados e todas as respostas.

## O que está incluído
- Site responsivo e formulário de whitelist com perguntas situacionais mais completas.
- Correção calculada no servidor: 10 pontos por resposta correta, total de 100; 80 ou mais = aprovado; menos de 80 = reprovado.
- Código privado para consultar o resultado.
- Painel ADM com login, pesquisa/filtro e leitura individual das inscrições.
- RLS nas tabelas e Edge Functions protegidas por allowlist de e-mails.
- **Nenhuma notificação, webhook ou envio de inscrições para Discord.** O campo de nome de usuário Discord é apenas informativo.

## 1. Configurar Supabase
1. Crie um projeto em https://supabase.com.
2. No SQL Editor, execute o arquivo `supabase/schema.sql`.
3. Em Project Settings → API, copie Project URL e a chave `anon`/publishable.
4. Edite `assets/js/config.js` e preencha `SUPABASE_URL` e `SUPABASE_ANON_KEY`. A chave pública pode estar no frontend; nunca publique a `service_role`.
5. Em Authentication → Providers, mantenha Email habilitado.
6. Em Authentication → Users, crie um usuário para cada administrador (e-mail + senha). Desative o cadastro público de usuários se não quiser que outras pessoas criem contas.
7. No SQL Editor, adicione cada e-mail administrativo, em minúsculas, na tabela de allowlist:

```sql
insert into public.wl_admins (email) values ('admin@seudominio.com');
```

Só cadastre pessoas autorizadas. A função também confere a variável secreta `ADMIN_EMAILS`, então a autorização precisa existir nos dois locais.

## 2. Configurar segredos e publicar as funções
Instale o Supabase CLI, entre na conta e associe o projeto:

```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase secrets set SUPABASE_URL="https://SEU-PROJETO.supabase.co"
supabase secrets set SUPABASE_ANON_KEY="SUA_CHAVE_ANON_PUBLICA"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="SUA_SERVICE_ROLE"
supabase secrets set ADMIN_EMAILS="admin@seudominio.com,outro@seudominio.com"
supabase functions deploy submit-wl
supabase functions deploy wl-status
supabase functions deploy admin-list
```

Use os valores reais do seu projeto. Nunca coloque `SUPABASE_SERVICE_ROLE_KEY` em `config.js`, HTML ou qualquer arquivo do GitHub.

## 3. Publicar no GitHub Pages
1. Envie todos os arquivos e pastas deste pacote ao repositório, preservando a estrutura.
2. No GitHub, entre em Settings → Pages.
3. Em Build and deployment, selecione Deploy from a branch, escolha `main` e `/ (root)` e salve.
4. Espere a publicação e abra o endereço indicado pelo GitHub.

## 4. Como funciona a aprovação
As dez questões de múltipla escolha valem 10 pontos cada. A função `submit-wl` valida as respostas no servidor, calcula a nota sem confiar no navegador e grava o status automaticamente:
- **80–100 pontos:** `approved`.
- **0–70 pontos:** `rejected`.

História e motivação são guardadas para leitura da equipe, mas não alteram a nota automática. Ajuste as regras do servidor se quiser mudar o critério no futuro.

## 5. Painel administrativo
Clique em “Painel ADM” no menu, entre com um usuário criado em Supabase Authentication e cadastrado tanto em `wl_admins` quanto no segredo `ADMIN_EMAILS`. A lista permite pesquisar por nome/Discord e filtrar aprovados/reprovados; clique em uma inscrição para ler as respostas completas.

Se a lista não carregar, confira se a função `admin-list` foi publicada e se o e-mail está escrito em minúsculas nos dois lugares. O usuário administrativo não deve ser compartilhado.

## 6. Segurança antes de abrir inscrições
- Não exponha a chave `service_role`.
- O endpoint público de inscrição não exige login; para uso público, acrescente CAPTCHA/Turnstile e limite de envios para reduzir spam.
- Configure aviso de privacidade e prazo de retenção dos dados.
- Faça um teste completo com inscrições fictícias antes de divulgar.
- O texto das regras do site é uma base e deve ser revisado para corresponder ao regulamento oficial da cidade.
