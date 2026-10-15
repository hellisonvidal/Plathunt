PS-Platinum

Gerenciador de troféus da PlayStation com feed social: acompanhe seus troféus, veja as conquistas dos amigos da PSN, mande os parabéns e reaja com emojis.

## Funcionalidades

- **Login direto com a PSN**: o usuário cola o código NPSSO da própria conta Sony e o app faz o resto. Não existe cadastro nem senha própria.
- **Meus troféus**: nível, contagem por tipo, lista de jogos com progresso e a página de cada jogo com todos os troféus, incluindo a raridade de cada um.
- **Feed social**: troféus conquistados por você e pelos seus amigos da PSN que também usam o Perseus. As platinas aparecem em destaque.
- **Reações com emoji**: 🏆 🔥 👏 🎉 😮 💪 😂 ❤️, com atualização otimista na tela.
- **Parabéns**: mensagens rápidas que mudam conforme o tipo do troféu, ou um texto livre.
- **Notificações**: quando alguém reage ou dá os parabéns por uma conquista sua.
- **Amigos e ranking de platinas**: a lista de amigos é espelhada da PSN, então ninguém precisa adicionar amigos de novo.

## Como funciona o login

A Sony não oferece um "Entrar com PlayStation" público para apps de terceiros. O Perseus usa o mesmo fluxo da biblioteca [`psn-api`](https://psn-api.achievements.app), usado por vários apps da comunidade:

1. O usuário faz login em playstation.com.
2. No mesmo navegador, abre `https://ca.account.sony.com/api/v1/ssocookie` e copia o JSON `{"npsso":"..."}`. Pode colar o JSON inteiro, o app extrai o token sozinho.
3. O servidor troca o NPSSO por um access token e um refresh token OAuth da PSN. O NPSSO é **descartado** logo em seguida.
4. Os tokens são guardados criptografados com **AES-256-GCM**. O access token é renovado automaticamente com o refresh token, que dura cerca de 2 meses. Depois disso o usuário só precisa entrar de novo.

A sessão do app usa um cookie `httpOnly`. No banco fica apenas o hash SHA-256 desse cookie.

> ⚠️ Essa API não é oficial. A Sony pode mudar ou bloquear esse fluxo, e o uso pode conflitar com os termos de serviço da PSN. O app não é afiliado à Sony.

## Stack

Next.js 15 (App Router, Server Actions) · React 19 · TypeScript · Prisma (SQLite em dev; troque para Postgres em produção) · Tailwind CSS 4 · Vitest.

## Rodando localmente

```bash
npm install
cp .env.example .env
# gere a chave e cole em PERSEUS_SECRET:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
npm run db:push
npm run dev
```

Abra http://localhost:3000 e entre com a sua conta PSN.

### Dados de demonstração (sem conta PSN)

```bash
npm run db:seed                 # cria Kratos_BR, Aloy_Hunter e Ellie_TLOU com troféus, reações e parabéns
npm run demo:login -- Kratos_BR # imprime um cookie de sessão para colar no navegador
```

> O `db:seed` apaga todos os dados sociais do banco local antes de recriar os dados de exemplo.

### Testes

```bash
npm test        # vitest
npm run lint    # typecheck
```

## Estrutura

```
prisma/schema.prisma      modelos: User, Session, Friendship, Game, UserTitle, Trophy, Activity, Reaction, Congratulation, Notification
src/lib/psn.ts            login via NPSSO e renovação de tokens
src/lib/sync.ts           sincronização com a PSN (perfil, amigos, jogos e troféus → feed)
src/lib/social.ts         feed e permissões (só você e seus amigos podem interagir)
src/app/actions.ts        server actions: login, sync, reações, parabéns, notificações
src/app/                  páginas: feed, /trophies, /games/[id], /u/[onlineId], /friends, /notifications, /login
```

### Sincronização

- Acontece no login e pelo botão "Sincronizar com a PSN", com intervalo mínimo de 5 minutos entre execuções automáticas.
- A cada execução, baixa os troféus de no máximo 10 jogos com progresso novo, para respeitar o rate limit da PSN. Contas com muitos jogos completam a importação ao longo de várias sincronizações.
- Cada troféu conquistado vira um item do feed, posicionado pela data real em que foi conquistado.

## Próximos passos sugeridos

- Sincronização periódica em segundo plano (cron) para o feed se atualizar sozinho.
- Notificações push e PWA (instalar no celular).
- Comparar o progresso com um amigo jogo a jogo.
- Deploy com Postgres (Vercel + Neon/Supabase, por exemplo).
