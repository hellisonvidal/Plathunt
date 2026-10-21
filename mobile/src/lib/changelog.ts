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
