# Trophy Mania

Gerenciador de troféus da PlayStation: acompanhe seus troféus e veja as conquistas dos seus amigos da PSN.

O repositório tem duas versões:

| | **App Android** (`mobile/` + `android/`) | **Versão web com servidor** (raiz) |
|---|---|---|
| Precisa de servidor? | **Não.** Fala direto com a PSN pelo celular | Sim (Node + PostgreSQL) |
| Login PSN | A tela da PlayStation abre sozinha ao iniciar | Colar o código NPSSO |
| Seus troféus, jogos e raridade | ✅ | ✅ |
| Feed com troféus dos amigos | ✅ (lido direto da PSN) | ✅ (amigos que usam o app) |
| Ranking de platinas | ✅ | ✅ |
| Reações com emoji, parabéns e notificações | — (precisam de um servidor compartilhado) | ✅ |

## App Android (sem servidor)

### Instalar

1. No GitHub, abra **Actions → Android APK** e clique na execução mais recente (ou em **Run workflow** para gerar uma nova).
2. Em **Artifacts**, baixe **trophy-mania-android** e descompacte. Dentro está o `app-debug.apk`.
3. No celular, abra o APK e permita "instalar apps de fontes desconhecidas".

O APK é gerado sozinho a cada mudança no app. Não é preciso configurar nada.

### Como funciona

- **Login:** ao abrir o app, o formulário de login da PlayStation aparece sozinho (mesmo fluxo OAuth do app oficial). Quando você termina de entrar, a Sony redireciona com um código, que `PsnLoginActivity.java` captura e o app troca pelos tokens de acesso. Se o aparelho já estiver logado na Sony, a tela fecha sozinha. "Sair" também apaga o login da Sony do aparelho, para dar para entrar com outra conta.
- **Dados:** a interface (`mobile/`, React + Vite) vai dentro do APK e chama a API da PSN com o HTTP nativo do Capacitor (o `fetch` do navegador seria bloqueado por CORS). Os tokens e um cache das respostas ficam só no aparelho. O token de acesso é renovado sozinho por cerca de 2 meses; depois disso é só entrar de novo.
- **Feed de atividade:** junta os seus troféus e os dos amigos dos últimos 30 dias. Para não estourar o limite de chamadas da PSN, considera os 3 jogos mais recentes de cada amigo e no máximo 20 jogos por atualização. Amigos com troféus privados não aparecem.
- **Modo demonstração:** a tela de login tem "Ver demonstração", com dados de exemplo.

### Desenvolver

```bash
npm install && npm install --prefix mobile
npm run dev --prefix mobile        # abre no navegador (use "Ver demonstração")
npm test --prefix mobile
npm run android:build              # compila mobile/ e copia para android/
npx cap open android               # abre no Android Studio → Run
```

O ícone (troféu de platina) fica em `assets/*.svg`, e os PNGs em `android/app/src/main/res/mipmap-*`.

> ⚠️ A API da PSN usada aqui não é oficial. A Sony pode mudar ou bloquear esse fluxo, e o uso pode conflitar com os termos de serviço da PSN. O app não é afiliado à Sony.

## Versão web com servidor (opcional)

Next.js 15 (App Router, Server Actions) · React 19 · TypeScript · Prisma + PostgreSQL · Tailwind CSS 4 · Vitest.

Além do que o app Android faz, tem a parte social completa: reações com emoji (🏆 🔥 👏 🎉 😮 💪 😂 ❤️), mensagens de parabéns e notificações. Para isso, todos os usuários precisam usar o mesmo servidor.

### Login

1. O usuário faz login em playstation.com.
2. No mesmo navegador, abre `https://ca.account.sony.com/api/v1/ssocookie` e copia o JSON `{"npsso":"..."}`. Pode colar o JSON inteiro, o app extrai o token sozinho.
3. O servidor troca o NPSSO por tokens OAuth da PSN e descarta o NPSSO. Os tokens ficam criptografados com **AES-256-GCM**, e a sessão usa um cookie `httpOnly` (no banco fica só o hash SHA-256).

### Rodando localmente

Precisa de um PostgreSQL local (a URL padrão está em `.env.example`).

```bash
npm install
cp .env.example .env
# gere a chave e cole em PERSEUS_SECRET:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
npm run db:migrate
npm run dev
```

Dados de demonstração: `npm run db:seed` cria Kratos_BR, Aloy_Hunter e Ellie_TLOU (apaga os dados sociais do banco local antes). Depois, `npm run demo:login -- Kratos_BR` imprime um cookie de sessão para colar no navegador.

Testes: `npm test` e `npm run lint`.

### Publicando (Render)

1. Crie uma conta em [render.com](https://render.com) e conecte o GitHub.
2. Clique em **New → Blueprint** e escolha este repositório. O `render.yaml` cria o servidor web e o banco Postgres, e gera a `PERSEUS_SECRET` sozinho.

> O plano gratuito do Render "dorme" após 15 min sem acesso, e o banco gratuito expira em 30 dias.

### Estrutura

```
prisma/schema.prisma      modelos: User, Session, Friendship, Game, UserTitle, Trophy, Activity, Reaction, Congratulation, Notification
src/lib/psn.ts            login via NPSSO e renovação de tokens
src/lib/sync.ts           sincronização com a PSN (perfil, amigos, jogos e troféus → feed)
src/lib/social.ts         feed e permissões (só você e seus amigos podem interagir)
src/app/actions.ts        server actions: login, sync, reações, parabéns, notificações
src/app/                  páginas: feed, /trophies, /games/[id], /u/[onlineId], /friends, /notifications, /login
```

## Próximos passos sugeridos

- Reações e parabéns no app Android, com um backend gratuito (ex.: Supabase).
- Notificações quando um amigo platinar.
- APK assinado para publicar na Google Play.
- Comparar o progresso com um amigo jogo a jogo.
