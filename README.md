# PlayStation Trophy Mania

Gerenciador de troféus da PlayStation: acompanhe seus troféus e veja as conquistas dos seus amigos da PSN.

O repositório tem duas versões:

| | **App Android** (`mobile/` + `android/`) | **Versão web com servidor** (raiz) |
|---|---|---|
| Precisa de servidor? | **Não.** Fala direto com a PSN pelo celular | Sim (Node + PostgreSQL) |
| Login PSN | A tela da PlayStation abre sozinha ao iniciar | Colar o código NPSSO |
| Perfil: avatar PSN, nível, jogos com tempo de jogo | ✅ | — (sem tempo de jogo) |
| Troféus por jogo base e DLC, filtro conquistados/bloqueados | ✅ | — |
| Estatísticas por plataforma, comparação com amigos | ✅ | — |
| Amigos: avatar, nível, plataformas, conquistas | ✅ | ✅ |
| Atividades com troféus dos amigos | ✅ (lido direto da PSN) | ✅ (amigos que usam o app) |
| Curtidas com emoji (padrão e PlayStation △ ○ ✕ □) | ✅ salvas no celular; os amigos não veem | ✅ compartilhadas |
| Ranking de platinas | ✅ | ✅ |
| Parabéns e notificações | — (precisam de um servidor compartilhado) | ✅ |

## App Android (sem servidor)

### Instalar

1. No GitHub, abra **Releases** e baixe `PlayStation-Trophy-Mania.apk` da versão mais recente. (Versões de branches que ainda não estão na `main` ficam em **Actions → Android APK → Artifacts**.)
2. No celular, abra o APK e permita "instalar apps de fontes desconhecidas".

Cada mudança que chega na `main` gera uma Release `build-N` automaticamente. Todas as versões são assinadas com a mesma chave (`android/app/debug.keystore`), então uma versão nova instala por cima da anterior. O login, o modo, as configurações e as curtidas ficam também no armazenamento nativo do Android (`@capacitor/preferences`), então uma atualização não pede login de novo.

Para fechar o app, toque duas vezes em voltar (nas abas principais e no login). Dentro de um jogo, perfil de amigo ou das configurações, voltar retorna à tela anterior.

### Configurações e atualizações

A engrenagem no topo das abas abre as Configurações:

- **Conta**: sair / trocar de conta PSN.
- **Atualizações**: versão instalada e "Verificar atualizações", que compara com a última Release do GitHub. "Baixar e instalar" baixa o APK dentro do app, com barra de progresso (`AppUpdaterPlugin.java`, só aceita endereços do GitHub), e abre o instalador do Android. Na primeira vez, o Android pede para permitir que o app instale atualizações.
- **PlayStation Plus**: plano (Essential, Extra, Premium, Deluxe) e data de vencimento, mostrados no Perfil com o selo do PS Plus e a contagem de dias. A PSN só informa *se* a conta tem PS Plus, não o plano nem o vencimento, por isso esses dois são preenchidos aqui.
- **Atividades**: período de 7, 30 ou 90 dias.
- **Troféus e jogos**: idioma dos nomes vindos da PSN (português, inglês ou espanhol) e opção de revelar troféus secretos.
- **Aparência**: 5 temas: PlayStation (padrão), Claro, Preto OLED, Grafite e Carmesim. O contraste do texto foi verificado (WCAG ≥ 4.5:1) em todos.
- **Geral**: aba em que o app abre.
- **Dados**: atualizar tudo da PSN agora e apagar as curtidas.

### Abas

1. **Perfil**: avatar PSN, nível e progresso, troféus e a lista de jogos com tempo de jogo (busca e ordenação por recentes, progresso ou tempo). Em cada jogo, os troféus vêm agrupados em listas recolhíveis, uma para o **jogo base** e uma para cada **DLC**, com progresso de cada uma; toque na lista para abrir. Há filtro Todos / Conquistados / Bloqueados, e cada troféu tem um botão **Dicas no YouTube**, que busca um vídeo pelo nome do jogo e do troféu.
2. **Estatísticas** (comparação com amigos escolhidos em ordem alfabética; "Títulos por plataforma" lista os jogos de cada plataforma, seus e do amigo; só jogos com pelo menos um troféu conquistado; cada jogo conta em uma única plataforma, a registrada no tempo de jogo ou a principal da lista de troféus, então uma lista "PS4,PSVITA" não faz o PS Vita aparecer se você não jogou lá): jogos, platinas, jogos 100%, conclusão média, troféus e tempo de jogo, com gráficos por tipo de troféu, plataforma e jogos mais jogados. Filtro pelas plataformas que têm troféus e comparação com qualquer amigo.
3. **Amigos**: **todos** os amigos da PSN (a lista vem em páginas), com busca e ordenação por nível, platinas ou nome. Mostra avatar, nível e progresso, plataformas e conquistas. Os perfis carregam aos poucos, e as plataformas de cada amigo só são buscadas quando o cartão aparece na tela, para não estourar o limite de chamadas da PSN.
4. **Atividades**: troféus seus e dos amigos dos últimos 30 dias, com curtidas por emoji.
5. **Ranking de platinas**: você e seus amigos por platinas, nível ou total de troféus.

O tempo de jogo vem da lista de "jogados" da PSN, que só registra PS4 e PS5. Como a PSN não liga essa lista à de troféus, o app casa os dois pelo nome do jogo.

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

A imagem do ícone fica em `assets/app-icon.jpg`. Os PNGs gerados a partir dela (ícone adaptativo, redondo e splash) ficam em `android/app/src/main/res/`.

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
