# Política de privacidade — Plathunt

> **App não oficial.** O Plathunt não é afiliado, patrocinado nem aprovado pela Sony Interactive Entertainment. PlayStation e PSN são marcas da Sony.

*Última atualização: 22 de outubro de 2026*

O Plathunt é um app independente, sem ligação com a Sony Interactive Entertainment. PlayStation é marca da Sony.

## O que fica só no seu celular

- **Login da PSN:** o token da sua sessão PSN fica salvo apenas no aparelho e é usado para falar direto com os servidores da PlayStation.
- **Dados do app:** configurações, curtidas, convocações de boost, desafios, méritos e histórico de preços ficam salvos no celular.

O app não tem anúncios nem rastreadores, e não vende nem compartilha dados com terceiros.

## Recursos online

Os recursos online vêm ligados. Na primeira vez que você entra com a PSN, um aviso explica o que vai para o servidor e você escolhe entre **Manter ligados** ou **Desligar**; nada é enviado antes dessa escolha. Dá para mudar a qualquer momento em **Configurações → Recursos online**. Com eles, suas curtidas chegam ao dono da conquista e os pedidos de boost vão direto para o app dos amigos que também usam o Plathunt.

**Como sua identidade é confirmada:** ao ligar, o app envia o token da sua sessão PSN uma única vez para o servidor do app (Cloudflare Workers). O servidor usa o token só para confirmar seu ID na PSN e não o guarda.

**O que fica guardado no servidor:**

- seu accountId e seu ID online da PSN, e a URL do seu avatar;
- as curtidas que você dá: em qual conquista, de quem é a conquista e qual emoji;
- os pedidos de boost que você envia e as respostas: jogo, troféus, horário, recado e destinatário.

**Quem vê esses dados:** curtidas e perfis são visíveis para outros usuários do app com recursos online. Cada pedido de boost só é visível para quem enviou e quem recebeu.

**Onde e por quanto tempo:** os dados ficam em um banco de dados Cloudflare D1 (região leste dos Estados Unidos) e permanecem lá enquanto os recursos online estiverem em uso.

**Como apagar:** desligar os recursos online desconecta o celular. Para apagar todos os seus dados do servidor na hora, use **Configurações → Recursos online → Apagar meus dados do servidor**. Se você não tem mais o app instalado, veja [como pedir a exclusão dos seus dados](excluir-dados.md).

## Serviços que o app consulta

O app fala direto, do celular, com estes serviços. Nenhum deles recebe a sua senha nem dados do servidor do Plathunt; como em qualquer acesso à internet, eles veem o endereço IP do aparelho.

- **PlayStation Network (Sony):** troféus, perfil, amigos e status online, com o token da sua sessão.
- **PlayStation Store (Sony):** catálogo, preços e demos da loja (sem login).
- **playstation.com (Sony):** a lista de avaliações da PS Plus, na página pública de jogos da PS Plus (sem login).
- **Google Tradutor:** só com "Traduzir nomes e descrições" ligado em Configurações, os nomes e descrições de troféus que a Sony não traduziu (nenhum dado da conta).
- **Ícones de sites (Google):** os ícones do PlayStationTrophies.org e do PSNProfiles nos botões de guias.
- **Links externos que você toca** (vídeos de dicas, guias, página do jogo na loja) abrem no navegador ou no app do serviço, com as políticas deles.

## Idade

O app é destinado a maiores de 13 anos, a mesma idade mínima para ter uma conta da PlayStation Network na maioria dos países.

## Segurança

- **Sua senha da PSN nunca passa pelo app:** o login é feito na própria página da Sony; o app recebe só os tokens da sessão.
- **Os tokens ficam só neste celular:** não entram no backup na nuvem nem na transferência para outro aparelho.
- **App assinado com chave própria:** o Android só aceita atualizações assinadas com a mesma chave secreta, então ninguém consegue instalar uma versão falsa por cima do app para ler o seu login.
- **Servidor com regras por usuário:** o servidor só aceita quem tem a conta confirmada pela PSN, e cada pessoa só cria curtidas e pedidos em nome próprio, e os nomes exibidos vêm da PSN (ninguém troca o próprio nome para se passar por outro jogador).

## Notificações

As notificações são geradas no próprio celular, e você pode desligá-las em **Configurações → Notificações**.

## Mudanças nesta política

Quando esta política mudar, a data no topo é atualizada e as mudanças importantes aparecem nas Novidades do app.

## Contato

Pelo e-mail de contato do desenvolvedor na página do Plathunt na Google Play, ou em <https://github.com/hellisonvidal/Plathunt/issues> (público: não publique dados pessoais).
