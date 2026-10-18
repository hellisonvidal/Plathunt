# Segurança do Plathunt

As contas da PSN guardam jogos comprados, então o objetivo é que **nada que
dê acesso à conta saia do celular** e que o servidor dos recursos online só
deixe cada jogador agir em nome próprio.

## Como a conta fica protegida

| Risco | Proteção |
| --- | --- |
| Roubo da senha | O app nunca vê a senha: o login é na página da Sony (`PsnLoginActivity`), que só navega em domínios da Sony; qualquer outro endereço abre no navegador. |
| Falsa atualização que lê o login | APK do GitHub e AAB da Play Store em **release**, assinados com a **chave secreta** (segredos `ANDROID_KEYSTORE_*`). A chave de debug do repositório é pública e só serve para testes. |
| Cópia dos tokens por backup ou USB | `allowBackup="false"` e `data_extraction_rules.xml` (nada vai para a nuvem nem para outro celular); builds de release não são depuráveis. |
| Arquivos expostos a outros apps | O FileProvider só entrega a pasta da atualização baixada (`cache/updates`). |
| Atualização adulterada | O app só baixa atualizações das Releases do GitHub (lista de endereços conferida a cada redirecionamento) e o Android confere a assinatura. |
| Alguém se passar por outro jogador | A função `psn-login` confirma o accountId com a própria Sony antes de criar a sessão. As regras do banco (RLS) só deixam criar curtidas e pedidos em nome próprio, e o nome exibido vem do perfil confirmado pela PSN. |
| Contas criadas fora do app | Sem perfil confirmado pela PSN, uma conta não vê perfis nem curtidas. |
| Spam de pedidos de boost | Limite de 30 pedidos por hora por jogador (gatilho no banco). |
| Muitos acessos ao mesmo tempo | Cada usuário tem a própria sessão e as regras valem linha a linha no banco: um jogador nunca lê nem altera dados de outro, mesmo com muitos usando o app juntos. |

## O que você precisa fazer (uma vez)

1. **Cadastrar a chave do app** nos segredos do GitHub (passo a passo em `docs/play-store.md`). Até lá, o APK continua saindo com a chave pública de testes e o build mostra um aviso.
2. **Aplicar a migração de segurança** `supabase/migrations/20261018230000_security.sql` no Supabase: no painel, **SQL Editor → New query**, cole o arquivo e rode (ou peça para o Claude aplicar com a sua aprovação).
3. **Supabase → Authentication → Sign In / Providers → Email:** desligue **Allow new users to sign up**. O app cria as contas pelo servidor (função `psn-login`), então nada quebra; isso impede contas criadas por fora.
4. **Avisar quem já usa o APK do GitHub:** a primeira versão assinada com a chave nova não instala por cima da antiga (assinatura diferente). É preciso desinstalar uma vez e instalar a nova; o login é refeito.
