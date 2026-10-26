/**
 * Novidades de cada atualização (o "log de atualização"). Aparece uma vez no
 * primeiro acesso depois de atualizar o app. Para uma nova versão, adicione
 * uma entrada no topo com `id` maior; os textos são chaves de tradução.
 */
export interface ChangelogEntry {
  id: number;
  items: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    id: 28,
    items: [
      "⬆️ Versão da Play Store: quando sai uma versão nova, a janela de atualização do Google Play abre sozinha, baixa em segundo plano e você reinicia o app com um toque.",
    ],
  },
  {
    id: 27,
    items: [
      "👥 Várias contas da PSN no mesmo celular: adicione outra conta em Configurações → Conta e troque entre elas com um toque, também no Perfil.",
    ],
  },
  {
    id: 26,
    items: [
      "🚀 Na tela de cada jogo, o botão Convocar boost já abre o pedido com os troféus de multiplayer que faltam.",
      "💬 Convite pelo WhatsApp vai direto para o app, com os emojis certos.",
    ],
  },
  {
    id: 25,
    items: [
      "✉️ Convite do boost no WhatsApp mais curto, com link curto do Plathunt.",
      "⬆️ Aviso de nova versão ao abrir o app, com atalho para atualizar pela Play Store.",
      "🛠️ Pedidos de boost não chegam mais em dobro.",
    ],
  },
  {
    id: 24,
    items: [
      "🎮 Boost redesenhado: só jogos e troféus de multiplayer, confirmação dos troféus e da desistência, convite aos amigos com notificação e resposta sim ou não, e convite pelo WhatsApp com link para instalar o app.",
    ],
  },
  {
    id: 23,
    items: [
      "📖 Guias: o PlayStationTrophies abre direto no guia do jogo ou do troféu, e o PSNProfiles no guia ou no próprio site; a busca no Google fica só para jogos que o site não tem.",
    ],
  },
  {
    id: 22,
    items: ["📌 Na lista de troféus, o jogo (ícone, nome e progresso) fica fixo no topo enquanto você rola, na ordem original e na de conquista."],
  },
  {
    id: 21,
    items: [
      "🔃 Lista de troféus: escolha \"Ordem original\" ou \"Ordem de conquista\"; toque de novo no mesmo botão para inverter a ordem.",
    ],
  },
  {
    id: 20,
    items: [
      "🗓️ Troféus em ordem de conquista: na lista de troféus de cada jogo (seus e dos amigos), escolha \"1ª conquista\" ou \"Mais recentes\".",
      "📖 Guias do PlayStationTrophies e do PSNProfiles abrem direto na página do guia, sem passar pela busca do Google.",
    ],
  },
  {
    id: 19,
    items: ["⏱️ Tempo até o 100% agora inclui os jogos sem platina, e os números da comparação ficam alinhados."],
  },
  {
    id: 18,
    items: [
      "⏱️ Tempo até a platina / 100% agora compara você e o amigo: média, o mais rápido e os jogos em comum lado a lado.",
    ],
  },
  {
    id: 17,
    items: [
      "👥 Estatísticas: escolha o jogador e com quem comparar no mesmo lugar, com avatar; ao voltar de um jogo, continua no mesmo jogador.",
      "⏱️ Comparação do tempo de jogo nos jogos que você e o amigo têm em comum.",
    ],
  },
  {
    id: 16,
    items: [
      "📊 Estatísticas dos amigos: escolha o amigo em Estatísticas → \"Estatísticas de\" ou toque em \"📊 Estatísticas\" no cartão dele, na aba Amigos.",
      "🛒 Loja mais leve: as imagens dos jogos ficaram 15% menores e são baixadas no tamanho da tela.",
    ],
  },
  {
    id: 15,
    items: [
      "🚪 Sair / trocar de conta apaga os dados da conta no celular e a próxima entrada pede o login da PSN de novo.",
    ],
  },
  {
    id: 14,
    items: [
      "🔑 Login da Sony no navegador do celular (Chrome, Brave…), com chave de acesso (passkey), senha salva e volta automática para o app.",
    ],
  },
  {
    id: 12,
    items: [
      "🔑 Conta da Sony com chave de acesso (passkey): entre pelo navegador em “Problemas? Entrar manualmente” (o botão da chave de acesso na tela da Sony fechava o app).",
    ],
  },
  {
    id: 11,
    items: [
      "🛒 Loja: moeda e preços do país da sua conta da PSN (não mais do idioma do celular), com Canadá, Austrália, Chile, Colômbia e Peru.",
      "📖 Guias do PSNProfiles e do PlayStationTrophies voltam a encontrar resultados.",
    ],
  },
  {
    id: 10,
    items: [
      "🕒 Troféus mostram a data e a hora exatas da conquista, também nos jogos dos amigos.",
      "📥 Pedidos de boost recebidos ficam só dentro do app: ao topar, quem pediu vê a resposta no Plathunt.",
    ],
  },
  {
    id: 9,
    items: [
      "🛒 Loja: tocar num jogo volta a abrir no navegador, sempre na página do jogo. Quem preferir o app PlayStation pode ligar em Configurações → Loja.",
    ],
  },
  {
    id: 8,
    items: [
      "🛒 Loja: edições com nome, como Game of the Year, Definitive e Complete, aparecem como edição premium.",
    ],
  },
  {
    id: 7,
    items: [
      "🔔 Com o app aberto, as notificações aparecem dentro do app e levam direto à tela certa, como o pedido de boost recebido.",
      "📣 Boost: o botão Novo boost abre a convocação em uma janela, e o catálogo de jogos só carrega nessa hora. Seus pedidos e as respostas podem ser compartilhados no WhatsApp, Telegram, Discord e outros apps.",
      "📥 Pedidos recebidos com novo visual: quem pediu, o jogo, os troféus e o que falta, com aceitar e recusar à mão.",
      "🛒 Loja: tocar num jogo abre no app PlayStation, quando ele está instalado (dá para desligar em Configurações → Loja).",
    ],
  },
  {
    id: 6,
    items: [
      "🎨 Ícone novo: o troféu de platina dentro da mira, maior e com fundo próprio, nítido em qualquer tela inicial.",
      "🧪 Loja: as avaliações da PS Plus Premium/Deluxe aparecem em Todos e no filtro Avaliação, com a lista oficial da PlayStation.",
    ],
  },
  {
    id: 5,
    items: [
      "🛒 Loja: tipos revisados com o catálogo inteiro da PlayStation Store. Edições Standard e Padrão aparecem como jogo completo, e edições premium, pacotes de jogos, avaliações e demos ficam cada um no seu filtro.",
      "🎮 Loja: nova categoria Demos, com as demos gratuitas da loja (também em Todos), e complementos das ofertas no filtro DLC.",
    ],
  },
  {
    id: 4,
    items: [
      "🏁 Desafios: quando você e o amigo já têm o mesmo troféu, o desafio fica bloqueado.",
      "🏆 Troféus na ordem original da PlayStation e, nos jogos de um amigo, um filtro com os troféus que você tem ou não.",
      "🏅 5.000 méritos, e o aviso de novos méritos não se repete mais.",
      "🎮 Conquistas: escolha o amigo numa caixa de seleção, como nos Méritos.",
      "🛒 Loja: ordenar por lançamento (mais recentes ou mais antigos), e edições premium, pacotes e jogos completos não se misturam mais.",
    ],
  },
  {
    id: 3,
    items: [
      "🌐 Recursos online em um servidor novo, mais rápido e sempre no ar, e agora dá para apagar seus dados do servidor em Configurações → Recursos online.",
    ],
  },
  {
    id: 2,
    items: [
      "🛒 Loja: filtros com várias opções ao mesmo tempo e tipos mais precisos (edição premium, pacote, avaliação), com os preços alinhados nos cartões.",
      "📊 Estatísticas abrem na hora com os dados salvos (puxe a tela para atualizar) e mostram as plataformas numa linha compacta.",
      "📱 Tela ajustada a cada aparelho: celulares pequenos e grandes, tablets, dobráveis e celular deitado, respeitando o recorte da câmera.",
      "📊 Perfil e Estatísticas mostram a situação de cada jogo: 100% com DLC, sem DLC, PSN, platina sem 100% e não concluídos.",
      "🐞 Varredura de erros e correções de estabilidade.",
    ],
  },
  {
    id: 1,
    items: [
      "🔔 As notificações abrem direto na tela certa: méritos, desafios, boost, pedidos recebidos ou o jogo do amigo.",
      "🔑 Lembrar a conta da Sony ao sair, e salvar a senha pelo gerenciador de senhas do Android na tela da Sony.",
      "🛒 Loja: só atualiza quando você puxa a tela (o resto do tempo usa a lista salva) e mostra o tipo do produto (jogo, demo, avaliação, DLC...) com filtro.",
      "💯 Perfil e Estatísticas separam 100% com DLC, 100% sem DLC e 100% PSN (jogos sem platina).",
      "🏅 2.000 méritos, com gêneros de jogos, calendário, marcos e ranking de méritos entre amigos.",
      "📝 Novidades como estas aparecem uma vez depois de cada atualização (e ficam em Configurações → Atualizações).",
    ],
  },
];

export const LATEST_CHANGELOG = CHANGELOG[0];
