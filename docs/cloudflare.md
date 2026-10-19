# Servidor dos recursos online (Cloudflare)

Curtidas, pedidos de boost direto no app e os nomes dos amigos que usam o
Plathunt passam por um **Cloudflare Worker** com um banco **D1** (pasta
`cloudflare/`). Troféus, amigos e o login da PSN **não** passam por ele.

O plano gratuito da Cloudflare cobre o app com folga (cerca de 100 mil
chamadas por dia e 5 GB de banco) e, ao contrário do Supabase gratuito, não
pausa o servidor quando fica alguns dias sem uso.

## Configurar (uma vez)

1. **Crie uma conta grátis** em <https://dash.cloudflare.com/sign-up>.
2. No painel, abra **Workers e Pages** uma vez: isso cria o seu subdomínio
   `*.workers.dev`, onde o servidor vai ficar.
3. **ID da conta:** em **Workers e Pages**, o **Account ID** aparece na lateral
   direita. Copie.
4. **Token de API:** em **My Profile → API Tokens → Create Token**, use o modelo
   **Edit Cloudflare Workers** e, em **Permissions**, adicione também
   **Account → D1 → Edit**. Crie e copie o token (ele só aparece uma vez).
5. No GitHub, em **Settings → Secrets and variables → Actions → New repository
   secret**, cadastre:

   | Segredo | Valor |
   | --- | --- |
   | `CLOUDFLARE_API_TOKEN` | o token do passo 4 |
   | `CLOUDFLARE_ACCOUNT_ID` | o ID do passo 3 |

6. Rode **Actions → Servidor (Cloudflare) → Run workflow**. Na primeira vez ele
   cria o banco `plathunt`, aplica as tabelas, publica o Worker
   `plathunt-api` e gera a chave das sessões. O endereço aparece no resumo da
   execução (`https://plathunt-api.<seu-subdomínio>.workers.dev`).
7. Rode **Actions → Android APK → Run workflow** (ou mande qualquer mudança
   para a main): o build descobre o endereço sozinho e grava no app.

Depois disso, cada mudança na pasta `cloudflare/` publica o servidor de novo
automaticamente. Se preferir fixar o endereço, crie a variável de repositório
`PLATHUNT_API_URL` (**Secrets and variables → Actions → Variables**).

Sem esses passos o app funciona normalmente, só com os recursos online
indisponíveis (Configurações → Recursos online avisa).

## Como a segurança funciona

- **Login:** o app manda o token da sessão PSN uma única vez para
  `POST /v1/login`; o Worker pergunta à própria Sony quem é o dono do token
  (não guarda o token) e devolve uma **sessão assinada** (HMAC-SHA256, 30
  dias) com o accountId confirmado. A chave das sessões é um segredo do Worker
  (`SESSION_SECRET`) que nem o repositório nem o app conhecem.
- **Cada rota só mexe nos dados de quem está logado:** curtidas e pedidos são
  gravados sempre com o accountId da sessão (o que vier no corpo do pedido é
  ignorado), só o destinatário responde um pedido de boost, e o nome exibido de
  quem enviou vem do perfil confirmado pela PSN.
- **Limites:** 30 pedidos de boost por hora por jogador, até 50 destinatários
  por pedido, textos e pedidos com tamanho máximo.
- **Sem conta por fora:** não existe cadastro por e-mail ou senha; só entra
  quem tem uma sessão PSN válida.
- **Apagar dados:** Configurações → Recursos online → **Apagar meus dados do
  servidor** remove perfil, curtidas e pedidos (`POST /v1/account/delete`).
- **Testes:** `mobile/tests/worker.test.ts` roda o Worker contra um SQLite de
  verdade e confere cada regra (sessão forjada, adulterada ou vencida, curtir
  ou responder em nome de outro, limite por hora, apagar dados).

## Rotas

| Rota | O que faz |
| --- | --- |
| `POST /v1/login` | Confirma o ID na PSN e devolve a sessão |
| `POST /v1/profiles` | Nomes dos usuários do app, por accountId |
| `POST /v1/likes` | Curte ou desfaz (`on: false`) em nome próprio |
| `POST /v1/likes/query` | Curtidas destas conquistas |
| `GET /v1/likes/mine?since=` | Curtidas recebidas desde a data |
| `POST /v1/boosts` | Envia um pedido de boost para amigos |
| `GET /v1/boosts` | Pedidos enviados e recebidos |
| `POST /v1/boosts/answer` | O destinatário aceita ou recusa |
| `POST /v1/account/delete` | Apaga todos os dados do jogador |

## Supabase

O app não usa mais o Supabase. Depois de confirmar que os recursos online
funcionam pela Cloudflare, o projeto `trophy-mania` do Supabase pode ser
apagado no painel dele (**Project Settings → General → Delete project**).
