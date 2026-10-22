# Publicar na Play Store

Guia completo para colocar o Plathunt na Google Play. O app já está preparado; os passos marcados com **(você)** dependem da sua conta e não podem ser feitos pelo repositório.

## Situação

| Item | Situação |
| --- | --- |
| Pacote AAB da Play Store (versão `play`, sem autoatualização nem `REQUEST_INSTALL_PACKAGES`) | ✅ gerado pelo GitHub Actions |
| `targetSdk` 36 / `compileSdk` 36 (exigência da Play: 35 ou mais) | ✅ |
| Permissões: só internet, notificações, `WAKE_LOCK` e `RECEIVE_BOOT_COMPLETED` (lembretes depois de reiniciar) | ✅ nenhuma exige declaração |
| Alarme exato (`SCHEDULE_EXACT_ALARM`) | ✅ removido: os lembretes são agendados sem horário exato |
| Política de privacidade pública | ✅ [docs/privacidade.md](privacidade.md) |
| Página de exclusão de dados (exigida para apps com dados em servidor) | ✅ [docs/excluir-dados.md](excluir-dados.md) |
| Exclusão de dados dentro do app | ✅ Configurações → Recursos online → Apagar meus dados do servidor |
| Acesso para o revisor sem conta | ✅ botão **Ver demonstração** na tela de entrada |
| Ícone 512×512 (PNG 32 bits), imagem de destaque 1024×500, capturas | ✅ em `assets/play-store/` |
| Textos da página da loja (pt-BR e en-US) | ✅ abaixo |
| Chave de envio cadastrada no GitHub | ⏳ **(você)**, passo 1 |
| Conta de desenvolvedor, teste fechado e envio | ⏳ **(você)**, passos 3 a 6 |

As duas versões do app são geradas juntas pelo GitHub Actions (Actions → Android APK):

| Versão | Arquivo | Atualização |
| --- | --- | --- |
| **GitHub** | APK (`plathunt-android` e Releases) | por dentro do app (Configurações → Atualizações) |
| **Play Store** | AAB (`plathunt-play-store`) | pela própria Play Store |

> As duas usam o mesmo id, **`app.plathunt.trophytracker`** (é o "Nome do pacote" na Play
> Console e não pode mudar depois da primeira publicação). Quem tem o APK do GitHub
> instalado precisa desinstalá-lo antes de instalar pela Play Store (o login é refeito).
>
> Até o build 14, o id era `com.hellisonvidal.perseus`, e no build 15, `com.hellisonvidal.plathunt`. Para o Android cada id é outro app:
> quem tem essa versão instala a nova e apaga a antiga (a atualização por dentro do app
> antigo baixa a nova, que aparece ao lado da antiga até ela ser desinstalada).

## 1. Criar e cadastrar a chave de envio (você, uma vez só)

No computador (precisa do Java):

```bash
keytool -genkeypair -v -keystore upload.keystore -alias upload \
  -keyalg RSA -keysize 2048 -validity 10000
```

Guarde o `upload.keystore` e a senha fora do repositório (gerenciador de senhas, por exemplo). Se perder, dá para pedir a troca da chave de envio na Play Console.

No GitHub, em **Settings → Secrets and variables → Actions → New repository secret**:

| Segredo | Valor |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 upload.keystore` (no Mac: `base64 -i upload.keystore`) |
| `ANDROID_KEYSTORE_PASSWORD` | a senha do keystore |
| `ANDROID_KEY_ALIAS` | `upload` |
| `ANDROID_KEY_PASSWORD` | a senha da chave (se for a mesma, repita) |

> Com a chave cadastrada, o APK do GitHub também passa a sair assinado com ela.
> Quem tem o APK antigo (chave de testes) precisa desinstalar uma vez e instalar o novo.

## 2. Gerar o pacote

Em **Actions → Android APK → Run workflow** (na `main`). Ao terminar, baixe o artefato **plathunt-play-store**: dentro está o `app-play-release.aab`, assinado. O número da versão (`versionCode`) sobe sozinho a cada build (10000 + build).

## 3. Conta de desenvolvedor (você)

1. Crie a conta em <https://play.google.com/console> (taxa única de US$ 25) e confirme a identidade.
2. **Contas pessoais criadas depois de novembro de 2023** precisam de um **teste fechado com pelo menos 12 testadores por 14 dias seguidos** antes de liberar a produção (passo 5).
3. Cadastre um **e-mail de contato** público: ele aparece na página do app e é o canal da [exclusão de dados](excluir-dados.md) sem o app.

## 4. Criar o app na Play Console

1. **Criar app**: nome `Plathunt: Trophy Tracker`, nome do pacote `app.plathunt.trophytracker`, idioma padrão **Português (Brasil)**, **App**, **Gratuito**. Aceite as declarações.
2. **Assinatura do app pelo Google Play**: aceite. O Google guarda a chave final; a sua é só de envio.
3. **Conteúdo do app** (menu "Política e programas → Conteúdo do app"):

| Seção | Resposta |
| --- | --- |
| Política de privacidade | `https://github.com/hellisonvidal/Plathunt/blob/main/docs/privacidade.md` |
| Acesso ao app | **Parte da funcionalidade é restrita.** Instruções: "Na tela de entrada, toque em *Ver demonstração* para usar o app com dados de exemplo, sem conta. As funções com dados reais exigem uma conta da PlayStation Network do próprio usuário; o login é feito na página oficial da Sony." |
| Anúncios | Não, o app não contém anúncios |
| Classificação de conteúdo | Categoria **Outros apps** (utilitário/referência de jogos). Violência, sexo, drogas, palavrões, jogos de azar: **não**. Usuários interagem? **Sim** (curtidas e pedidos de boost entre usuários, sem chat livre). Compartilha a localização? **Não**. Compras digitais? **Não** (a Loja só mostra preços e abre a PlayStation Store) |
| Público-alvo | **13 a 15, 16 a 17 e 18+** (não marque menores de 13). O app não foi feito para crianças |
| App de notícias | Não |
| ID de publicidade | Não usa |
| Apps governamentais / financeiros / saúde | Não |
| Segurança dos dados | Tabela abaixo |
| Exclusão de dados | URL: `https://github.com/hellisonvidal/Plathunt/blob/main/docs/excluir-dados.md` |

### Segurança dos dados

- **O app coleta ou compartilha dados?** Sim (só com os recursos online).
- **Criptografados em trânsito?** Sim (HTTPS).
- **O usuário pode pedir a exclusão?** Sim (no app e pela página de exclusão).
- **Compartilhamento com terceiros:** nenhum. A Cloudflare só hospeda o servidor (operador de dados, não conta como compartilhamento).

| Tipo de dado | Coletado | Obrigatório? | Finalidade |
| --- | --- | --- | --- |
| Informações pessoais → **IDs do usuário** (accountId e ID online da PSN, URL do avatar) | Sim | Opcional (recursos online podem ser desligados) | Funcionalidade do app; gerenciamento da conta |
| Atividade no app → **Outros conteúdos gerados pelo usuário** (curtidas e pedidos de boost) | Sim | Opcional | Funcionalidade do app |

Não declarar: senha (o login é na página da Sony e o app nunca vê a senha), localização, contatos, fotos, dados financeiros, identificadores do aparelho, diagnóstico ou analytics (não há). O token da sessão PSN vai uma vez ao servidor só para confirmar a identidade e não é guardado (processamento temporário). Troféus, amigos e configurações ficam só no celular e não contam como coletados.

## 5. Página da loja e teste fechado

**Página principal da loja** (Crescer → Presença na loja → Página principal):

- **Categoria:** Entretenimento. **Tags:** jogos, estatísticas.
- **Ícone:** `assets/play-store/icone-512.png`
- **Imagem de destaque:** `assets/play-store/destaque-1024x500.png`
- **Capturas** (8 por tipo, ordem: perfil, troféus de um jogo, estatísticas, amigos, atividades, méritos, boost, loja):

| Pasta | Tamanho | Onde enviar |
| --- | --- | --- |
| `assets/play-store/capturas/com-legenda/celular/` | 1080×1920 | Telefone |
| `assets/play-store/capturas/com-legenda/tablet-7/` | 1200×2134 | Tablet de 7" |
| `assets/play-store/capturas/com-legenda/tablet-10/` | 1600×2844 | Tablet de 10" |

`sem-legenda/` tem as mesmas telas sem título e sem a faixa de app não oficial. As capturas usam o modo demonstração e o tema Escuro, com ícones genéricos no lugar das capas (sem artes da Sony). Para refazer depois de mudar o app: `node scripts/play-store-screenshots.cjs` (instruções no topo do script).

**Teste fechado** (Testar e lançar → Testes → Teste fechado): crie a faixa, envie o `.aab`, adicione uma lista de e-mails com **12 ou mais testadores** (amigos com Android) e mantenha-os inscritos por **14 dias**. Eles instalam pelo link de participação da faixa. Depois disso, a Play Console libera o pedido de acesso à produção.

**Produção:** crie a versão com o mesmo `.aab` (ou um mais novo), escolha os países e envie para revisão (costuma levar de alguns dias a uma semana na primeira vez).

## 6. Textos da página da loja

### Português (Brasil)

**Nome (30):** `Plathunt: Trophy Tracker`

**Descrição curta (80):** `App não oficial: seus troféus da PSN, platinas, estatísticas e amigos.`

**Descrição completa:**

```
⚠️ App não oficial: o Plathunt não é afiliado, patrocinado nem aprovado pela Sony Interactive Entertainment. PlayStation e PSN são marcas da Sony, citadas só para indicar com o que o app funciona.

Acompanhe seus troféus da PlayStation Network no celular:

🏆 Perfil completo: nível, platinas, jogos 100% (com e sem DLC), tempo de jogo e a conclusão de cada jogo.
🎮 Troféus de cada jogo na ordem original, separados por jogo base e DLC, com data e hora da conquista, progresso dos objetivos e guias em vídeo e escritos.
📊 Estatísticas por plataforma e por ano, tempo até a platina, ranking e comparação com amigos.
👥 Amigos da PSN com status online, nível e conquistas recentes, com curtidas.
🏁 Desafios entre amigos: quem conquista o troféu primeiro.
📣 Boost: chame amigos para troféus online e cooperativos e receba os pedidos deles direto no app.
🏅 5.000 méritos para desbloquear.
🛒 Ofertas da PlayStation Store com o menor preço já visto, demos e avaliações da PS Plus.
🔔 Notificações de méritos, desafios, platinas dos amigos e pedidos de boost.
🎨 Temas claro, escuro e inspirados em jogos, em 7 idiomas.

🔐 Privacidade: o login é feito na página oficial da Sony; o app nunca vê nem guarda a sua senha. Seus dados ficam no celular, e os recursos online (curtidas e pedidos de boost) podem ser desligados ou apagados a qualquer momento.

Grátis, sem anúncios e sem compras.
```

**Notas da versão (primeira publicação):**

```
Primeira versão na Google Play: troféus, estatísticas, amigos, desafios, boost, 5.000 méritos e ofertas da PlayStation Store.
```

### English (United States) — tradução da página

**Name:** `Plathunt: Trophy Tracker`

**Short description:** `Unofficial app: your PSN trophies, platinums, stats and friends.`

**Full description:**

```
⚠️ Unofficial app: Plathunt is not affiliated with, sponsored or endorsed by Sony Interactive Entertainment. PlayStation and PSN are trademarks of Sony, mentioned only to describe what the app works with.

Track your PlayStation Network trophies on your phone:

🏆 Full profile: level, platinums, 100% games (with and without DLC), playtime and completion for every game.
🎮 Each game's trophies in their original order, split into base game and DLC, with the exact date and time earned, objective progress and video and written guides.
📊 Stats by platform and year, time to platinum, rankings and friend comparisons.
👥 Your PSN friends with online status, level and recent trophies, with likes.
🏁 Challenges between friends: who earns the trophy first.
📣 Boost: call friends for online and co-op trophies and get their requests right in the app.
🏅 5,000 merits to unlock.
🛒 PlayStation Store deals with the lowest price ever seen, demos and PS Plus game trials.
🔔 Notifications for merits, challenges, friends' platinums and boost requests.
🎨 Light, dark and game-inspired themes, in 7 languages.

🔐 Privacy: you sign in on Sony's official page; the app never sees or stores your password. Your data stays on your phone, and online features (likes and boost requests) can be turned off or deleted at any time.

Free, no ads, no purchases.
```

## Nome e marca

- **Título:** `Plathunt: Trophy Tracker` (24 de 30 caracteres). Nome embaixo do ícone: `Plathunt`.
- O nome não usa "PlayStation", "PSN" nem "PS" (marcas da Sony). Citar na descrição que o app funciona com os troféus da PSN é permitido, junto do aviso de app não oficial (a política de propriedade intelectual da Play pede que fique claro que não há vínculo com a marca).
- **Ícone:** troféu de platina dentro de uma mira, sem os símbolos dos botões da PlayStation (`assets/app-icon.svg`).

## Se a revisão recusar

- **Propriedade intelectual / falsa representação:** responder pelo formulário de apelação explicando que o app é independente, mostra só os dados do próprio usuário pela conta dele, tem o aviso de app não oficial no nome da loja, na descrição, nas capturas e dentro do app, e não usa logotipos da Sony.
- **Acesso ao app:** reforçar que o modo demonstração cobre todas as telas sem conta.
- **Segurança dos dados:** conferir se a tabela acima foi preenchida igual.
