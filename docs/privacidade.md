# Política de privacidade — Plathunt

> **App não oficial.** O Plathunt não é afiliado, patrocinado nem aprovado pela Sony Interactive Entertainment. PlayStation e PSN são marcas da Sony.

*Última atualização: 17 de outubro de 2026*

O Plathunt é um app independente, sem ligação com a Sony Interactive Entertainment. PlayStation é marca da Sony.

## O que fica só no seu celular

- **Login da PSN:** o token da sua sessão PSN fica salvo apenas no aparelho e é usado para falar direto com os servidores da PlayStation.
- **Dados do app:** configurações, curtidas, convocações de boost, desafios, méritos e histórico de preços ficam salvos no celular.

O app não tem anúncios nem rastreadores, e não vende nem compartilha dados com terceiros.

## Recursos online

Os recursos online vêm ligados. Na primeira vez que você entra com a PSN, um aviso explica o que vai para o servidor e você escolhe entre **Manter ligados** ou **Desligar**; nada é enviado antes dessa escolha. Dá para mudar a qualquer momento em **Configurações → Recursos online**. Com eles, suas curtidas chegam ao dono da conquista e os pedidos de boost vão direto para o app dos amigos que também usam o Plathunt.

**Como sua identidade é confirmada:** ao ligar, o app envia o token da sua sessão PSN uma única vez para a função `psn-login` do servidor do app (Supabase). A função usa o token só para confirmar seu ID na PSN e não o guarda.

**O que fica guardado no servidor:**

- seu accountId e seu ID online da PSN, e a URL do seu avatar;
- as curtidas que você dá: em qual conquista, de quem é a conquista e qual emoji;
- os pedidos de boost que você envia e as respostas: jogo, troféus, horário, recado e destinatário.

**Quem vê esses dados:** curtidas e perfis são visíveis para outros usuários do app com recursos online. Cada pedido de boost só é visível para quem enviou e quem recebeu.

**Onde e por quanto tempo:** os dados ficam em um banco de dados Supabase hospedado em São Paulo (Brasil) e permanecem lá enquanto os recursos online estiverem em uso.

**Como apagar:** desligar os recursos online desconecta o celular. Para apagar todos os seus dados do servidor, abra uma solicitação em <https://github.com/hellisonvidal/Trophy-Mania/issues>, que eles serão removidos.

## Notificações

As notificações são geradas no próprio celular, e você pode desligá-las em **Configurações → Notificações**.

## Contato

<https://github.com/hellisonvidal/Trophy-Mania/issues>
