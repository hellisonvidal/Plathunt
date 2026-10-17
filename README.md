# PlayStation Trophy Mania

Gerenciador de troféus da PlayStation: acompanhe seus troféus e veja as conquistas dos seus amigos da PSN.

O repositório tem duas versões:

| | **App Android** (`mobile/` + `android/`) | **Versão web com servidor** (raiz) |
|---|---|---|
| Precisa de servidor? | **Não.** Fala direto com a PSN pelo celular | Sim (Node + PostgreSQL) |
| Login PSN | Entra sozinho se a Sony já estiver logada no aparelho; senão, o formulário da PlayStation | Colar o código NPSSO |
| Perfil: avatar PSN, nível, jogos com tempo de jogo | ✅ | — (sem tempo de jogo) |
| Troféus por jogo base e DLC, filtro conquistados/bloqueados | ✅ | — |
| Estatísticas por plataforma, comparação com amigos | ✅ | — |
| Amigos: avatar, nível, plataformas, conquistas | ✅ | ✅ |
| Atividades com troféus dos amigos | ✅ (lido direto da PSN) | ✅ (amigos que usam o app) |
| Curtidas com emoji (padrão e PlayStation △ ○ ✕ □) | ✅ salvas no celular; os amigos não veem | ✅ compartilhadas |
| Ranking de platinas (dentro de Estatísticas) | ✅ | ✅ |
| Parabéns e notificações | — (precisam de um servidor compartilhado) | ✅ |

## App Android (sem servidor)

### Instalar

1. No GitHub, abra **Releases** e baixe `PlayStation-Trophy-Mania.apk` da versão mais recente. (Versões de branches que ainda não estão na `main` ficam em **Actions → Android APK → Artifacts**.)
2. No celular, abra o APK e permita "instalar apps de fontes desconhecidas".

Cada mudança que chega na `main` gera uma Release `build-N` automaticamente. Todas as versões são assinadas com a mesma chave (`android/app/debug.keystore`), então uma versão nova instala por cima da anterior. O login, o modo, as configurações e as curtidas ficam também no armazenamento nativo do Android (`@capacitor/preferences`), então uma atualização não pede login de novo.

Para atualizar qualquer tela, **puxe a tela para baixo** a partir do topo (não há botão de atualizar). Para fechar o app, toque duas vezes em voltar (nas abas principais e no login). Dentro de um jogo, perfil de amigo ou das configurações, voltar retorna à tela anterior.

### Configurações e atualizações

A engrenagem no topo das abas abre as Configurações:

- **Conta**: sair / trocar de conta PSN (o único lugar com o botão de sair).
- **Atividades**: período de 7, 30 ou 90 dias.
- **Troféus e jogos**: idioma dos nomes vindos da PSN (português, inglês ou espanhol), **tradução automática dos troféus** (ligada por padrão) e opção de revelar troféus secretos. Muitos jogos não têm os troféus traduzidos pela Sony, e aí a PSN manda o texto original, em geral em inglês. Com a tradução automática, nomes e descrições são traduzidos para o idioma escolhido pelo tradutor público do Google, direto do celular. A tradução fica salva no aparelho, então cada jogo é traduzido uma vez só; se o tradutor falhar, aparece o texto original. O botão "Dica em vídeo" continua buscando pelo nome original do troféu, que acha mais vídeos.
- **Aparência**: botão **Temas**, que abre a tela de temas com 10 opções com as cores dos personagens principais de jogos de PlayStation: Astro Bot (padrão: branco do corpo do robô, barras pretas como o visor e o azul dos olhos), Gran Turismo (fundo vermelho do logo com branco de pista), Demon's Souls (preto puro para telas OLED com o prata da armadura do Slayer), The Last of Us (verde-oliva de Ellie e cáqui de Joel), God of War (cinza das cinzas de Kratos com a tatuagem vermelha), Ratchet & Clank (pelo dourado de Ratchet), Marvel's Spider-Man (azul do traje de Peter com o vermelho da máscara), Uncharted (bege de mapa antigo com verde militar), Death Stranding (claro como a Bridges, com detalhes em laranja) e Horizon (azul-petróleo do Focus com o ruivo de Aloy). O contraste do texto foi verificado (WCAG ≥ 4.5:1) em todos. Quem usava o antigo tema Grafite passa para o The Last of Us.
- **Loja**: país da PlayStation Store (Brasil, Portugal, Estados Unidos, México, Argentina ou Espanha), que define a moeda e os preços.
- **Geral**: aba em que o app abre.
- **Dados**: atualizar tudo da PSN agora e apagar as curtidas.
- **Atualizações**: versão instalada e "Verificar atualizações", que compara com a última Release do GitHub. "Baixar e instalar" baixa o APK dentro do app, com barra de progresso (`AppUpdaterPlugin.java`, só aceita endereços do GitHub), e abre o instalador do Android. Na primeira vez, o Android pede para permitir que o app instale atualizações.

### Abas

1. **Perfil**: avatar PSN, nível e progresso, troféus e a lista de jogos com tempo de jogo (busca e ordenação por recentes, progresso ou tempo). Em cada jogo, os troféus vêm agrupados em listas recolhíveis, uma para o **jogo base** e uma para cada **DLC**, com progresso de cada uma; toque na lista para abrir. Há filtro Todos / Conquistados / Bloqueados, e troféus bloqueados que têm contador de objetivo na PSN (jogos de PS5, ex.: "Encontre 10 artefatos") mostram o progresso, como 6/10, com barra. Cada troféu tem os botões **Dica em vídeo** (busca no YouTube pelo nome do jogo e do troféu) e **Guia escrito** (busca o troféu no [PlayStationTrophies.org](https://www.playstationtrophies.org/), que usa endereços com ids próprios, então o app abre uma busca restrita ao site). No topo do jogo, **Guia completo** abre o roteiro para a platina do mesmo site. Na lista de jogos do perfil, cada jogo tem um selo e uma barra com a % de conclusão na cor de destaque do tema escolhido, mais forte quanto mais perto de 100% (o selo fica cheio nos jogos 100%), e o cartão do perfil mostra um gráfico circular com quantos jogos há em cada faixa e a conclusão média no centro, com as legendas empilhadas à direita.
2. **Estatísticas** (no topo, um seletor alterna entre **📊 Estatísticas** e **🏆 Ranking**, que mostra você e seus amigos por platinas, nível ou total de troféus; os quadros Jogos, Platinas, Jogos 100%, Conclusão média, Troféus e Tempo de jogo são tocáveis: abrem um **mural** em pop-up (que sobe da parte de baixo da tela e fecha no ✕, tocando fora ou no voltar) com as capas dos jogos da categoria escolhida, seus ou do amigo comparado, respeitando o filtro de plataforma; botão "Plataformas jogadas" que expande as plataformas, cada uma com o desenho 2D do controle do console (DualSense, DualShock 4, DualShock 3, o próprio PS Vita e o DualShock cinza clássico para "Todas") e quantos jogos cada jogador tem em cada uma; comparação com amigos escolhidos em ordem alfabética, usando a lista completa de jogos dos dois, e, ao escolher um amigo, comparação de títulos por plataforma: jogos em comum lado a lado com o progresso e a platina de cada um, quem está na frente, e os que só um dos dois jogou; "Títulos por plataforma" lista os jogos de cada plataforma, seus e do amigo; só jogos com pelo menos um troféu conquistado; cada jogo conta em uma única plataforma, a registrada no tempo de jogo ou a principal da lista de troféus, então uma lista "PS4,PSVITA" não faz o PS Vita aparecer se você não jogou lá): jogos, platinas, jogos 100%, conclusão média, troféus e tempo de jogo, com gráfico por tipo de troféu e jogos mais jogados. **Tempo até a platina / 100%**: para cada jogo platinado ou completo, quanto tempo levou do primeiro troféu até a platina e até o último troféu (com as datas), a média por platina e a platina mais rápida, ordenável por mais recentes, mais rápidos ou mais demorados. Filtro pelas plataformas que têm troféus e comparação com qualquer amigo.
3. **Amigos**: **todos** os amigos da PSN (a lista vem em páginas), com busca e ordenação por nível, platinas ou nome. Mostra quem está **online** (bolinha verde, console e jogo aberto) e quem está **offline** (há quanto tempo), com filtro Todos / Online / Offline e os online sempre no topo; quem esconde o status aparece como "Status oculto". Mostra avatar, nível e progresso, plataformas e conquistas. Os perfis carregam aos poucos, e as plataformas de cada amigo só são buscadas quando o cartão aparece na tela, para não estourar o limite de chamadas da PSN.
4. **Atividades**: troféus seus e de **todos** os amigos com troféus públicos, agrupados em um cartão por jogador, jogo e dia (com o total por tipo de troféu e "ver mais" quando há muitos), com curtidas por emoji. Filtros Tudo e Platinas.
   - **Boost** (botão no topo da aba): convocação para fazer troféus online ou cooperativos de um jogo escolhido. A busca cobre todo o catálogo PlayStation que o app conhece: seus jogos, os jogos de todos os amigos (com a lista de troféus da PSN) e o catálogo completo da PlayStation Store (para jogos que ninguém da lista jogou, a PSN não informa os troféus). Escolha o jogo, quantos jogadores faltam, quando, os troféus que faltam (opcional) e um recado; o app mostra quais amigos têm o jogo (o mesmo jogo em PS4 ou PS5 conta), quem está online agora, e gera o texto da convocação para enviar no WhatsApp, Telegram ou copiar (a PSN não deixa outros apps enviarem mensagens). Dá para marcar quem topou e concluir a convocação; tudo fica salvo no celular.
   - **Méritos** (botão no topo da aba): **500** conquistas do próprio app, liberadas por objetivos e divididas em 20 categorias: Platinas, Troféus, Ouro, Prata, Bronze, Nível PSN, Coleção, Conclusão, PS5, PS4, PS3, PS Vita, Plataformas, Tempo de jogo, Assiduidade, Temporadas (um mérito por ano de 2008 a 2026, mais platina e 100% em cada ano), DLCs, Social, Curiosidades e Especiais. Mostra o total desbloqueado, os próximos objetivos (os mais perto de liberar) e o progresso de cada mérito. Dá para ver os méritos de qualquer amigo com troféus públicos (sem os 23 de Social, que dependem de dados só seus).

5. **Loja**: catálogo da PlayStation Store com **todos** os jogos de cada categoria (Todos, Ofertas, PS5, PS4, Grátis e PS Plus; "Todos" junta PS5 e PS4); os jogos aparecem enquanto as páginas chegam, com o progresso no topo. Os jogos entram sozinhos ao rolar a tela (sem "ver mais"), com cartões de carregamento e imagens que aparecem suavemente. Busca, filtros no botão ao lado da busca (plataforma, faixa de preço: grátis, até X, X–Y, acima de Z, na moeda do país; só com desconto; esconder os jogos da PS Plus, para ver só o que não depende da assinatura) e ordenação por mais vendidos, **maior desconto**, menor ou maior preço e nome (A–Z ou Z–A). Cada jogo mostra o preço atual, o preço cheio riscado, o % de desconto e o **menor preço já visto**; tocar no jogo abre a página dele na PlayStation Store.
   - **Ofertas, Grátis e PS Plus:** a Sony troca essas categorias a cada campanha e por país, então o app tenta as conhecidas e, se nenhuma trouxer jogos, monta a lista a partir do catálogo completo de PS5 e PS4 (com desconto, gratuitos ou com o selo da PS Plus).
   - Não há lista de desejos: a da conta PSN não pode ser lida por outros apps (a Sony não libera a consulta).
   - O catálogo vem da mesma API pública que o site da loja usa (operação `categoryGridRetrieve`, sem login). A PSN não informa preços antigos, então o "menor preço" é o menor que o app registrou neste celular; "🔥 Menor preço já visto pelo app" aparece quando o preço atual é um recorde.

O tempo de jogo vem da lista de "jogados" da PSN, que só registra PS4 e PS5. Como a PSN não liga essa lista à de troféus, o app casa os dois pelo nome do jogo.

### Como funciona

- **Login:** ao abrir o app, se o aparelho já tiver um login da Sony salvo, o app entra sozinho, sem mostrar nenhuma página da Sony (`silentLogin` em `PsnLoginPlugin.java`). Senão, "Entrar com a PSN" abre direto o formulário compacto de usuário e senha da PlayStation (mesmo fluxo OAuth do app oficial); os redirects intermediários da Sony ficam escondidos atrás de um indicador de carregamento. Quando você termina de entrar, a Sony redireciona com um código, que `PsnLoginActivity.java` captura e o app troca pelos tokens de acesso. "Sair" também apaga o login da Sony do aparelho, para dar para entrar com outra conta.
- **Tela:** a interface se ajusta à resolução de cada celular. Textos, espaçamentos, ícones e avatares são medidos em `rem`, e o `rem` acompanha a largura da tela (14 px em telas estreitas, 16 px em ~390 px, até 18 px em telas grandes e tablets). As barras do sistema e o recorte da câmera são respeitados (áreas seguras do Capacitor 8), e o tamanho de fonte do Android é aplicado dentro de 85–115% para não quebrar o layout.
- **Dados:** a interface (`mobile/`, React + Vite) vai dentro do APK e chama a API da PSN com o HTTP nativo do Capacitor (o `fetch` do navegador seria bloqueado por CORS). Os tokens e um cache das respostas ficam só no aparelho. O token de acesso é renovado sozinho por cerca de 2 meses; depois disso é só entrar de novo.
- **Feed de atividade:** junta os seus troféus e os dos amigos dos últimos 30 dias. Os últimos 7 dias vêm sempre completos: todos os jogos com troféus nesse período são consultados (até 80) e nenhum troféu desses dias é cortado. Para os dias anteriores (30 ou 90, conforme as Configurações), entram no máximo 20 jogos a mais, para não estourar o limite de chamadas da PSN. Entram todos os amigos com troféus públicos (até 5 jogos recentes de cada); o perfil só é buscado para quem jogou no período. Amigos com troféus privados não aparecem.
- **Modo demonstração:** a tela de login tem "Ver demonstração", com dados de exemplo.

### Desenvolver

```bash
npm install && npm install --prefix mobile
npm run dev --prefix mobile        # abre no navegador (use "Ver demonstração")
npm test --prefix mobile
npm run android:build              # compila mobile/ e copia para android/
npx cap open android               # abre no Android Studio → Run
```

O ícone é um troféu de platina em 2D com fundo transparente, desenhado em vetor em `assets/app-icon.svg` (com uma versão `assets/app-icon.png` de 1024 px). Os PNGs gerados a partir dele ficam em `android/app/src/main/res/`: ícone comum e redondo, ícone adaptativo (troféu na camada da frente e camada de fundo transparente) e as telas de abertura.

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
