# Publicar na Play Store (versão 1.1.1)

O app tem duas versões, geradas juntas pelo GitHub Actions (Actions → Android APK):

| Versão | Arquivo | Atualização | Para quê |
| --- | --- | --- | --- |
| **GitHub** | APK (`trophy-mania-android` e Releases) | por dentro do app (Configurações → Atualizações) | instalar fora da loja, como até agora |
| **Play Store** | AAB (`trophy-mania-play-store`) | pela própria Play Store | enviar na Play Console |

A versão da Play Store não tem a atualização por dentro do app nem a permissão
`REQUEST_INSTALL_PACKAGES` (a política do Google não deixa o app se atualizar
sozinho). Em Configurações → Atualizações, ela mostra **Abrir na Play Store**.

> As duas versões usam o mesmo id (`com.hellisonvidal.perseus`) com assinaturas
> diferentes. Quem tem o APK do GitHub instalado precisa desinstalá-lo antes
> de instalar pela Play Store (os dados do app são apagados; o login é refeito).

## 1. Criar a chave de envio (uma vez só)

No computador (precisa do Java instalado):

```bash
keytool -genkeypair -v -keystore upload.keystore -alias upload \
  -keyalg RSA -keysize 2048 -validity 10000
```

Guarde o arquivo `upload.keystore` e a senha em um lugar seguro (fora do
repositório). Se perder, dá para pedir a troca da chave de envio na Play Console.

## 2. Cadastrar os segredos no GitHub

Em **Settings → Secrets and variables → Actions → New repository secret**:

| Segredo | Valor |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | o arquivo em base64: `base64 -w0 upload.keystore` (no Mac: `base64 -i upload.keystore`) |
| `ANDROID_KEYSTORE_PASSWORD` | a senha do keystore |
| `ANDROID_KEY_ALIAS` | `upload` |
| `ANDROID_KEY_PASSWORD` | a senha da chave (se for a mesma, pode repetir) |

Depois rode **Actions → Android APK → Run workflow** na `main`. O artefato
**trophy-mania-play-store** traz o `app-play-release.aab` assinado. Sem os
segredos, o AAB é compilado só para conferir e não é publicado como artefato.

## 3. Play Console

1. **Criar app**: nome `Plathunt: Trophy Tracker`, idioma padrão Português (Brasil), app gratuito, sem anúncios.
2. **Assinatura do app pelo Google Play**: aceitar (o Google guarda a chave final; a sua é só de envio).
3. **Teste interno** → criar versão → enviar o `.aab`. Testar em alguns aparelhos antes da produção.
4. **Conteúdo do app**:
   - **Política de privacidade**: `https://github.com/hellisonvidal/Trophy-Mania/blob/main/docs/privacidade.md`
   - **Acesso ao app**: o revisor pode usar **Ver demonstração** na tela inicial (sem conta). Para a PSN, ele precisa de uma conta PlayStation própria.
   - **Anúncios**: não.
   - **Classificação de conteúdo**: questionário (sem violência, sem compras; tem interação entre usuários só por curtidas e pedidos de boost).
   - **Público-alvo**: 13 anos ou mais.
   - **Segurança dos dados** (com os recursos online ligados): coleta **ID de usuário** (ID e avatar da PSN) e **outro conteúdo gerado pelo usuário** (curtidas e pedidos de boost), para *funcionalidade do app*; criptografado em trânsito; o usuário pode apagar os dados no próprio app (Configurações → Recursos online → Apagar meus dados do servidor). Senha da PSN: **não** é coletada (o login é na página da Sony). Troféus e amigos ficam só no aparelho.
5. **Página da loja**: ícone 512×512 (`assets/play-store/icone-512.png`), imagem de destaque 1024×500 (`assets/play-store/destaque-1024x500.png`), capturas de tela (abaixo), descrição curta e completa.

### Capturas de tela

Prontas em `assets/play-store/capturas/`, 8 por tipo de aparelho (o máximo da Play Store), tiradas no modo demonstração com o tema Escuro:

| Pasta | Tamanho | Onde enviar |
| --- | --- | --- |
| `celular/` | 1080×1920 | Capturas de tela do telefone |
| `tablet-7/` | 1200×2134 | Tablet de 7 polegadas |
| `tablet-10/` | 1600×2844 | Tablet de 10 polegadas |

- `com-legenda/`: com um título por tela e a faixa "App não oficial · não afiliado à Sony Interactive Entertainment" no rodapé (recomendado).
- `sem-legenda/`: a tela pura, se preferir.

Ordem: perfil, troféus de um jogo, estatísticas, ranking, amigos, atividades, méritos e loja.
As capas de jogos e avatares aparecem como ícones genéricos (dados de demonstração),
o que também evita mostrar artes da Sony na página da loja.

### Texto sugerido

**Descrição curta** (70 de 80 caracteres): App não oficial: seus troféus da PSN, platinas, estatísticas e amigos.

**Descrição completa:** ⚠️ App não oficial: o Plathunt não é afiliado, patrocinado nem aprovado pela Sony Interactive Entertainment. PlayStation e PSN são marcas da Sony, citadas só para indicar com o que o app funciona.

Acompanhe seus troféus da PSN no celular: platinas e jogos 100%, estatísticas por plataforma e por ano, tempo até a platina, comparação com amigos, atividades com curtidas, convocações de boost, desafios, 2.000 méritos e ofertas da loja de jogos com o menor preço já visto. Os dados vão direto do celular para a Sony; o app não pede nem guarda a sua senha.

## Nome e marca

- **Título na Play Store:** `Plathunt: Trophy Tracker` (24 caracteres; o limite é 30).
- **Nome embaixo do ícone:** `Plathunt` (vem de `capacitor.config.ts` e `android/app/src/main/res/values/strings.xml`).
- O nome não usa "PlayStation", "PSN" nem "PS" (marcas da Sony). Na descrição, citar
  que o app funciona com os troféus da PSN é permitido, junto do aviso "não afiliado à Sony".
- **Ícone:** troféu de platina dentro de um alvo de caça (mira azul com detalhes em vermelho), sem os símbolos dos botões da PlayStation (`assets/app-icon.svg`).

## Telas e aparelhos

- A interface escala pelo lado menor da tela (14–18 px por rem): celulares de 320 px a tablets e celular deitado mantêm a proporção.
- Respeita barra de status, barra de navegação e recorte da câmera em todos os lados (Android 15+ ocupa a tela inteira).
- Sem orientação travada: gira, funciona em tela dividida, janelas e dobráveis.
- O tamanho de fonte do Android é seguido entre 85% e 115%, para os textos caberem nos cartões.
