# Plathunt

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

## Versão e temas

No Perfil aparece o **nome verdadeiro** do jogador, quando ele compartilha o nome na PSN, e a lista de jogos pode ser ordenada por recentes, **mais antigos**, progresso ou tempo de jogo.

Versão **1.1.0** (o número do build vai junto: "1.1.0 (build N)"). Na tela de Temas, os temas aparecem em ordem alfabética e cada miniatura mostra uma tela do tema (barras, fundo, cartão e destaque), com o Automático metade claro e metade escuro. Além dos temas de jogos, há dois temas padrão, **Claro** e **Escuro**, e o **Automático** (padrão em instalações novas), que segue o claro/escuro do sistema do celular e acompanha a troca com o app aberto. No Perfil, o gráfico de conclusão dos jogos usa uma cor por faixa (verde, azul, roxo, laranja e vermelho) em todos os temas; as listas de jogos abaixo continuam nas cores do tema.

**Boost só com jogos multiplayer:** a PSN e a PlayStation Store não informam se um jogo tem modo online. O app considera multiplayer os jogos com troféus online, cooperativos, de partidas ranqueadas ou de versus (no idioma da PSN), que são justamente os que precisam de boost. A lista de troféus de cada jogo é verificada em segundo plano (seus jogos primeiro, depois os mais comuns entre os amigos) e a resposta fica guardada no celular; jogos só da loja, sem lista de troféus conhecida, ficam de fora desse filtro, que pode ser desligado.

## Pedidos de boost recebidos e notificações

**Pedidos recebidos (Boost):** a aba Boost tem "Meus pedidos" e "Pedidos recebidos". Sem servidor, o pedido viaja dentro da própria mensagem: a convocação enviada leva um link `trophymania://boost?d=…`. Quem recebe toca no link (o app abre direto em "Pedidos recebidos") ou cola a mensagem no painel. Só entram pedidos de outros jogadores; ao aceitar, o app monta a resposta oferecendo ajuda, pronta para enviar no WhatsApp, Telegram ou copiar.

**Notificações** (Configurações → Notificações, com chave geral e uma por tipo):
- **Novos méritos** liberados;
- **Desafios:** quando alguém vence e um dia antes do fim do prazo;
- **Lembretes de boost** no horário do pedido (hoje à noite e amanhã às 20h, fim de semana no sábado às 15h);
- **Platinas dos amigos**;
- **Novas versões do app**;
- **Curtidas e pedidos recebidos** (com os recursos online ligados).

As verificações rodam ao abrir o app e ao voltar para ele (no máximo a cada 15 minutos); lembretes e prazos ficam agendados no Android mesmo com o app fechado. Desligar a chave geral cancela os agendados.

**Temas:** o Astro Bot ganhou fundo azul (um tom médio, bem diferente do Claro) (bem diferente do Claro, que é cinza neutro) com as barras pretas do visor. O contraste de texto, destaques e do verde "online" foi conferido em todos os temas, e o Automático passou a receber do Android se o sistema está no modo escuro (WebViews antigos sempre respondiam "claro").

## "100%" no app

Em todo o app (quadro "Jogos 100%", mural, filtro "100%" do perfil, tempos até o 100% e méritos), **100% conta só jogos com DLC**: num jogo sem DLC o 100% acontece junto com a platina, então ele conta como platina. A barra e a porcentagem de cada jogo continuam mostrando o progresso real.

## Desafio a partir dos jogos de um amigo

No perfil de um amigo, ao abrir um jogo dele, **cada troféu** tem o botão **⚔️ Desafiar**, e há a **corrida da platina**. Quem já tem o troféu não conta no desafio (a tela avisa; se os dois já têm, não dá para criar). Basta escolher o prazo: o desafio vai para Atividades → Desafios.

## Novidades, notificações e login

- **Novidades:** no primeiro acesso depois de uma atualização, uma janela mostra o que mudou (`mobile/src/lib/changelog.ts`); numa instalação nova ela não aparece. Fica também em Configurações → Atualizações → Novidades desta versão.
- **Notificações:** tocar numa notificação abre a tela dela — méritos, desafios, boost, pedidos recebidos, o jogo do amigo que platinou ou as atualizações.
- **Login mais fácil:** em Configurações → Conta, "Lembrar a conta da Sony ao sair" (ligado por padrão) mantém o login da Sony no celular, e a próxima entrada é com um toque. Na tela da Sony, o gerenciador de senhas do Android (ex.: Google) pode salvar e preencher o e-mail e a senha; o app nunca guarda a senha.

## Telas e barras do sistema

No Android 15+ o app ocupa a tela toda, por baixo da barra de status e da barra de navegação. O cabeçalho de cada tela fica logo abaixo da barra de status (que mantém o fundo do tema), e o fim da lista sobra acima das abas e da barra de navegação. As medidas vêm do WebView ou, quando ele não informa, do próprio app (`MainActivity`, variáveis `--tm-inset-*`). As notificações usam um troféu de platina como ícone.

## Recursos online (Supabase gratuito)

Vêm ligados para quem entra com a PSN: na primeira abertura, um aviso explica o que vai para o servidor e o jogador escolhe **Manter ligados** ou **Desligar** (nada é enviado antes da escolha). Depois, o app reconecta sozinho, a menos que tenham sido desligados; dá para mudar em Configurações → Recursos online. Com eles:
- **Curtidas compartilhadas:** a curtida chega ao dono da conquista, que vê "curtido por…" em Atividades e recebe notificação;
- **Pedidos de boost direto no app:** no card do pedido, "📲 Enviar direto no app" lista os amigos que também usam o Plathunt com recursos online; o pedido aparece em "Pedidos recebidos" deles, e a resposta (aceitou/recusou) volta para quem enviou.

O servidor é um projeto Supabase (plano gratuito, região São Paulo). A função `supabase/functions/psn-login` confirma o ID da PSN com o token da própria sessão PSN (usado uma vez, não é guardado) e devolve a sessão do app; as tabelas (`supabase/migrations/`) têm regras de acesso (RLS) para que cada um só grave as próprias curtidas e pedidos. O app usa só a chave pública (publishable). Ficam guardados apenas ID e avatar da PSN, curtidas e pedidos de boost — veja a [política de privacidade](docs/privacidade.md).

## Idiomas

O app é multilíngue: português (Brasil), inglês, espanhol, francês, alemão, italiano e japonês. Na primeira abertura usa o idioma do aparelho (ou inglês, se o idioma não for um desses) e pode ser trocado em Configurações → Idioma, que vale para a interface e para os nomes de jogos e troféus da PSN. O país da loja também segue o aparelho (Brasil, Portugal, Estados Unidos, México, Argentina, Espanha, França, Alemanha, Itália, Reino Unido ou Japão). Os textos ficam em português no código e passam por `t()` (`mobile/src/i18n`); as traduções estão em `mobile/src/i18n/locales/`, e o teste `tests/i18n.test.ts` confere que todo texto tem tradução em todos os idiomas.

## App Android

### Instalar

1. No GitHub, abra **Releases** e baixe `Plathunt.apk` da versão mais recente. (Versões de branches que ainda não estão na `main` ficam em **Actions → Android APK → Artifacts**.)
2. No celular, abra o APK e permita "instalar apps de fontes desconhecidas".

Cada mudança que chega na `main` gera uma Release `build-N` automaticamente. Todas as versões são assinadas com a mesma chave (`android/app/debug.keystore`), então uma versão nova instala por cima da anterior. O login, o modo, as configurações e as curtidas ficam também no armazenamento nativo do Android (`@capacitor/preferences`), então uma atualização não pede login de novo.

Para atualizar qualquer tela, **puxe a tela para baixo** a partir do topo (não há botão de atualizar). Para fechar o app, toque duas vezes em voltar (nas abas principais e no login). Dentro de um jogo, perfil de amigo ou das configurações, voltar retorna à tela anterior.

### Configurações e atualizações

A engrenagem no topo das abas abre as Configurações:

- **Conta**: sair / trocar de conta PSN (o único lugar com o botão de sair).
- **Atividades**: período de 7, 30 ou 90 dias.
- **Troféus e jogos**: idioma dos nomes vindos da PSN (português, inglês ou espanhol), **tradução automática dos troféus** (ligada por padrão) e opção de revelar troféus secretos. Muitos jogos não têm os troféus traduzidos pela Sony, e aí a PSN manda o texto original, em geral em inglês. Com a tradução automática, nomes e descrições são traduzidos para o idioma escolhido pelo tradutor público do Google, direto do celular. A tradução fica salva no aparelho, então cada jogo é traduzido uma vez só; se o tradutor falhar, aparece o texto original. O botão "Dica em vídeo" continua buscando pelo nome original do troféu, que acha mais vídeos.
- **Aparência**: botão **Temas**, que abre a tela de temas com 10 opções com as cores dos personagens principais de jogos de PlayStation: Astro Bot (padrão: branco do corpo do robô, barras pretas como o visor e o azul dos olhos), Gran Turismo (fundo vermelho do logo com branco de pista), Demon's Souls (preto puro para telas OLED com o prata da armadura do Slayer), The Last of Us (verde-oliva de Ellie e cáqui de Joel), God of War (cinza das cinzas de Kratos com a tatuagem vermelha), Ratchet & Clank (pelo dourado de Ratchet), Marvel's Spider-Man (azul do traje de Peter com o vermelho da máscara), Uncharted (bege de mapa antigo com verde militar), Death Stranding (claro como a Bridges, com detalhes em laranja) e Horizon (azul-petróleo do Focus com o ruivo de Aloy). O contraste do texto foi verificado (WCAG ≥ 4.5:1) em todos. Quem usava o antigo tema Grafite passa para o The Last of Us.
- **Loja**: país da PlayStation Store (Brasil, Portugal, Estados Unidos, México, Argentina ou Espanha), que define a moeda e os preços, e de quanto em quanto tempo a loja salva no celular é atualizada (padrão: **só ao puxar a tela da loja**; ou a cada 30 minutos, 6 horas ou uma vez por dia).
- **Geral**: aba em que o app abre.
- **Dados**: atualizar tudo da PSN agora e apagar as curtidas.
- **Atualizações**: versão instalada e "Verificar atualizações", que compara com a última Release do GitHub. "Baixar e instalar" baixa o APK dentro do app, com barra de progresso (`AppUpdaterPlugin.java`, só aceita endereços do GitHub), e abre o instalador do Android. Na primeira vez, o Android pede para permitir que o app instale atualizações. Na versão da **Play Store** (AAB gerado junto, sem a atualização por dentro do app), o botão vira "Abrir na Play Store"; o passo a passo de publicação está em [docs/play-store.md](docs/play-store.md).

### Abas

1. **Perfil**: avatar PSN, nível e progresso, troféus por tipo com o total ao lado (ícone dos quatro troféus juntos) e a lista de jogos com tempo de jogo (busca, ordenação por recentes, mais antigos, progresso ou tempo e filtros Todos, Com platina, Sem platina, 100% com DLC, 100% sem DLC, 100% PSN e Em andamento, cada um com a contagem, e a linha "💯 100%: X com DLC · Y sem DLC · Z PSN" no cartão do perfil). Em cada jogo, os troféus vêm agrupados em listas recolhíveis, uma para o **jogo base** e uma para cada **DLC**, com progresso de cada uma; toque na lista para abrir. Há filtro Todos / Conquistados / Bloqueados, e troféus bloqueados que têm contador de objetivo na PSN (jogos de PS5, ex.: "Encontre 10 artefatos") mostram o progresso, como 6/10, com barra. Cada troféu tem os botões **Dica em vídeo** (busca no YouTube pelo nome do jogo e do troféu) e guias escritos do **[PlayStationTrophies.org](https://www.playstationtrophies.org/)** e do **[PSNProfiles](https://psnprofiles.com/)**. Os dois sites usam ids próprios nos endereços, então o app abre uma busca restrita às páginas de troféu (ou de guia) do site, com o nome oficial **em inglês** do jogo e do troféu entre aspas (buscado na PSN, já que a lista no app vem traduzida) e a plataforma, para cair exatamente naquele troféu daquele jogo. No topo do jogo, **Guia completo** abre o roteiro para a platina em cada um dos dois sites. Na lista de jogos do perfil, cada jogo tem um selo e uma barra com a % de conclusão na cor de destaque do tema escolhido, mais forte quanto mais perto de 100% (o selo fica cheio nos jogos 100%), e o cartão do perfil mostra um gráfico circular com quantos jogos há em cada faixa e a conclusão média no centro, com as legendas empilhadas à direita.
2. **Estatísticas** (no topo, um seletor alterna entre **📊 Estatísticas** e **🏆 Ranking**, que mostra você e seus amigos por platinas, nível ou total de troféus; os quadros Jogos, Platinas, Conclusão média, Troféus, Troféus não conquistados e Tempo de jogo (por último), com a seção **Situação dos jogos** logo abaixo (100% com DLC, 100% sem DLC, 100% PSN, Platina sem 100% e Não concluídos — cada jogo entra em uma só situação, então a soma é o total de jogos) e os quadros Platinas, Conclusão média, Troféus e **Troféus não conquistados** são tocáveis: abrem um **mural** em pop-up (que sobe da parte de baixo da tela e fecha no ✕, tocando fora ou no voltar) com as capas dos jogos da categoria escolhida, seus ou do amigo comparado, respeitando o filtro de plataforma; botão "Plataformas jogadas" que expande as plataformas, cada uma com o desenho 2D do controle do console fiel ao original (DualSense branco e preto com touchpad e barra de luz; DualShock 4 preto e compacto com touchpad; DualShock 3 clássico, sem touchpad, com o direcional e os botões em poços redondos, SELECT, START, botão PS e luzes; o próprio PS Vita; e o logo da PlayStation em prata, sem texto, para "Todas") e quantos jogos cada jogador tem em cada uma; comparação com amigos escolhidos em ordem alfabética, usando a lista completa de jogos dos dois, e, ao escolher um amigo, comparação de títulos por plataforma: jogos em comum lado a lado com o progresso e a platina de cada um, quem está na frente, e os que só um dos dois jogou; "Títulos por plataforma" lista os jogos de cada plataforma, seus e do amigo; todos os jogos da lista da PSN contam, inclusive os ainda sem troféu, como no perfil; cada jogo conta em uma única plataforma, a registrada no tempo de jogo ou a principal da lista de troféus, então uma lista "PS4,PSVITA" não faz o PS Vita aparecer se você não jogou lá): jogos, platinas, jogos 100%, conclusão média, troféus e tempo de jogo, com gráfico por tipo de troféu (com o total e os troféus não conquistados de cada tipo no fim), **jogos por ano** desde o primeiro jogo da conta (pelo ano em que começou a jogar, com as platinas de cada ano; todos os anos aparecem, sem "ver mais"; tocar no ano abre o mural com os jogos daquele ano) e **mais jogados** com o ícone de cada jogo e "Ver mais". **Tempo até a platina / 100%**: abas separadas para platinas e jogos 100%, com o ícone de cada jogo, cada uma com sua contagem, média e o mais rápido; a aba 100% considera só jogos com DLC (nos outros, o 100% é o mesmo momento da platina) e vai do primeiro ao último troféu, contando as DLCs. Ordenável por mais recentes, mais rápidos ou mais demorados. Filtro pelas plataformas que têm troféus e comparação com qualquer amigo.
3. **Amigos**: **todos** os amigos da PSN (a lista vem em páginas), com busca e ordenação por nível, platinas ou nome. Os cartões de amigos são compactos (avatar, nome, nível e status numa linha; troféus, plataformas e jogos em outra). Mostra quem está **online** (bolinha verde, console e jogo aberto) e quem está **offline** (há quanto tempo), com filtro Todos / Online / Offline e os online sempre no topo; quem esconde o status aparece como "Status oculto". Mostra avatar, nível e progresso, plataformas e conquistas. Os perfis carregam aos poucos, e as plataformas de cada amigo só são buscadas quando o cartão aparece na tela, para não estourar o limite de chamadas da PSN.
4. **Atividades**: troféus seus e de **todos** os amigos com troféus públicos, agrupados em um cartão por jogador, jogo e dia (com o total por tipo de troféu e "ver mais" quando há muitos), com curtidas por emoji (padrão e da PlayStation: △ ○ ✕ □, troféu de platina desenhado pelo app, 🎮 e 🏆). Filtros Tudo, Platinas, Ouro, Prata e Bronze, e busca por amigo (pelo ID da PSN).
   - **Boost** (botão no topo da aba): convocação para fazer troféus online ou cooperativos de um jogo escolhido. Há um filtro "Todo o catálogo / Só os meus jogos" ("Só os meus" mostra cada jogo da sua lista de troféus, inclusive versões de PS4 e PS5 separadas, até 20.000 jogos, buscados em páginas de 800). O catálogo completo começa a carregar em segundo plano assim que as Atividades abrem, é compartilhado entre Boost e Desafios e fica guardado por 30 minutos; enquanto carrega, a tela mostra o progresso (seus jogos, amigos e PlayStation Store) em vez de uma lista parcial. Os jogos aparecem em ordem alfabética, separados por plataforma (Todas, PS5, PS4, PS3, PS Vita), com todos os disponíveis para navegar (mais aparecem ao rolar), e a busca cobre todo o catálogo PlayStation que o app conhece: seus jogos, os jogos de todos os amigos (com a lista de troféus da PSN) e o catálogo completo da PlayStation Store (para jogos que ninguém da lista jogou, a PSN não informa os troféus). Escolha o jogo, entre na lista de troféus dele, separada como no perfil (jogo base e cada DLC em sua própria lista, que abre e fecha). Ao pedir boost, só aparecem os troféus que você ainda não tem; no modo "Responder a um pedido" dá para escolher um jogo que você já fez e oferecer ajuda (ícone, tipo, descrição e raridade, com filtro por tipo e opção de mostrar os que você já tem) e marque os troféus específicos que precisam de boost, quantos jogadores faltam, quando e um recado; o app mostra quais amigos têm o jogo (o mesmo jogo em PS4 ou PS5 conta), quem está online agora, e gera o texto da convocação para enviar no WhatsApp, Telegram ou copiar (a PSN não deixa outros apps enviarem mensagens). Dá para marcar quem topou e concluir a convocação; tudo fica salvo no celular.
   - **Desafios** (botão no topo da aba): escolha qualquer jogo do catálogo (seus jogos, a lista completa de jogos de cada amigo e toda a PlayStation Store, separados por plataforma) e fixe como objetivo um troféu do jogo ou a corrida da platina (para jogos que ninguém da lista jogou, a PSN não mostra os troféus, então o desafio é a platina); escolha os rivais (quem tem o jogo aparece primeiro) e um prazo (sem prazo, 7, 30 ou 90 dias), e veja quem conquista primeiro. A classificação usa as datas de conquista da PSN: vence o primeiro a conquistar depois do início do desafio e dentro do prazo; quem já tinha o troféu, não tem o jogo ou tem troféus privados aparece marcado. O convite sai pronto para WhatsApp ou para copiar. Os desafios ficam salvos no celular e contam para os Méritos.
   - **Méritos** (botão no topo da aba): **2.000** conquistas do próprio app, liberadas por objetivos e divididas em 25 categorias: Platinas, Troféus, Ouro, Prata, Bronze, Nível PSN, Coleção, Conclusão, PS5, PS4, PS3, PS Vita, Plataformas, Tempo de jogo, Assiduidade, Temporadas (por ano de 2008 a 2026: jogos, platinas, 100% e troféus de cada ano), DLCs, Social, Curiosidades, Especiais, **Desafios** (60), **Gêneros** (15 gêneros — Ação e Aventura, RPG, Tiro, Corrida, Esportes, Luta, Terror, Plataforma, Soulslike, Mundo Aberto, Estratégia, Quebra-cabeça, Música e Ritmo, Furtividade e Simulação — com jogos, platinas, 100%, troféus, horas, média e ouro em cada um; a PSN não informa o gênero, então o app reconhece pelo nome do jogo/franquia), **Calendário** (meses, dias da semana e períodos do dia), **Marcos** (níveis, platinas, troféus, ouro, prata, bronze e coleção em degraus) e **Alfabeto** (jogos e platinas de A a Z). A **data de cada mérito** é a do último troféu do jogo que o liberou (por exemplo, a 10ª platina leva a data do 10º jogo platinado); méritos sem troféu de origem (nível, tempo, amigos, curtidas, desafios) usam a primeira vez que o app os viu liberados. Mostra o total desbloqueado, os conquistados recentemente, os próximos objetivos e o progresso de cada mérito; dá para ver os méritos de qualquer amigo com troféus públicos. O **Ranking de méritos** compara você e os amigos com troféus públicos, contando só os méritos calculados pelos dados da PSN (sem amigos, curtidas e desafios, para ser justo).

5. **Loja**: catálogo da PlayStation Store com **todos** os jogos de cada categoria (Todos, Ofertas, PS5, PS4, Grátis e PS Plus; "Todos" junta PS5 e PS4); os jogos aparecem enquanto as páginas chegam, com o progresso no topo. Os jogos entram sozinhos ao rolar a tela (sem "ver mais"), com cartões de carregamento e imagens que aparecem suavemente. Cada cartão mostra o **tipo do produto** (jogo completo, **edição premium** — Deluxe, Ultimate, Gold, Definitiva..., pacote, DLC / complemento, demo, avaliação, moeda virtual ou outros), lido da classificação da própria loja (e do rótulo traduzido, como "Edição premium", "Pacote de jogos" ou "Avaliação de jogo"); quando a loja diz só "jogo completo" ou não informa, o nome decide: **avaliação** (Trial, Avaliação do jogo), **edição premium** (o jogo com extras: "Deluxe Edition", "Edição Ultimate", Jogo do Ano, "Jogo + Passe de Temporada"; a palavra só conta como edição, então "Marvel Ultimate Alliance" continua jogo completo) ou **pacote** (vários jogos juntos: Bundle, Coleção, Trilogia, "2 em 1", "Jogo A + Jogo B"). O tipo é recalculado com as regras atuais também no catálogo já salvo. Nos cartões, o preço fica no pé e alinhado entre os jogos da mesma linha. Nos filtros, cada opção mostra quantos jogos traz, e as opções que não mostrariam nada ficam escondidas. Plataforma, tipo e preço aceitam **várias opções ao mesmo tempo** (ex.: Demo + Avaliação, ou Grátis + R$ 50–100); tocar de novo numa opção marcada a desmarca, e sem nenhuma marcada o filtro volta a mostrar todos. Busca, filtros no botão ao lado da busca (plataforma, **tipo**, faixa de preço com as opções prontas na moeda do país (sem "Qualquer"), de "até R$ 5" e "até R$ 10" a "acima de R$ 400", ou mínimo e máximo digitados; só com desconto; esconder jogos grátis; esconder os jogos da PS Plus, para ver só o que não depende da assinatura). Jogos da PS Plus levam o ícone da PS Plus no cartão e ordenação por mais vendidos, **maior desconto**, menor ou maior preço e nome (A–Z ou Z–A). Cada jogo mostra o preço atual, o preço cheio riscado, o % de desconto e o **menor preço já visto**; tocar no jogo abre **a página daquele jogo** na PlayStation Store, no navegador (o app da PlayStation capturava o link e abria só na tela inicial dele). O catálogo fica salvo no celular (IndexedDB, que aguenta os milhares de jogos) e abre na hora; alguns segundos depois de abrir o app, ele é atualizado em segundo plano se a cópia salva já venceu, e a lista salva aparece enquanto a nova chega.
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

O ícone é um troféu de platina em 2D dentro de um alvo de caça (mira azul com detalhes em vermelho), sem os símbolos dos botões da PlayStation, com fundo transparente, desenhado em vetor em `assets/app-icon.svg` (com uma versão `assets/app-icon.png` de 1024 px). Os PNGs gerados a partir dele ficam em `android/app/src/main/res/`: ícone comum e redondo, ícone adaptativo (troféu na camada da frente e camada de fundo transparente) e as telas de abertura. Para a Play Store há `assets/play-store-icon.png` (512 px, fundo escuro) e `assets/play-store-feature.png` (imagem de destaque 1024×500).

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
