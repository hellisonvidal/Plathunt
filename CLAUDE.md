# Plathunt — guia rápido para o Claude

App Android (Capacitor) de troféus da PSN. Responda ao usuário em português.

## Onde fica cada coisa
- `mobile/` — o app (React 19 + Vite + Tailwind 4). Telas em `src/pages/`, componentes em `src/components/`, regras em `src/lib/`, PSN em `src/psn/` (cliente real `client.ts`, demonstração `demo.ts`).
- `mobile/src/i18n/locales/` — traduções (7 idiomas). Texto novo em `t("...")` precisa de tradução: crie `vN.ts` com o próximo número.
- `mobile/src/lib/changelog.ts` — novidades mostradas após atualizar (entrada nova no topo, `id` maior).
- `android/` — projeto nativo (Java em `app/src/{main,github,play}`).
- `cloudflare/` — servidor dos recursos online (Worker + D1); deploy pelo GitHub Actions.
- `docs/` — Play Store, segurança, privacidade, Cloudflare.
- Ignore: `.next/`, `src/`, `prisma/` na raiz (versão web antiga), `node_modules/`, `mobile/dist/`, `android/app/build/`.

## Comandos (em `mobile/`)
- `npx tsc --noEmit` · `npx vitest run` · `npm run build`
- Ver no navegador: `npx vite preview --port 4173`, botão "Ver demonstração".

## Como trabalhar gastando menos
- Use `Grep`/`Glob` com caminho (`mobile/src`) em vez de buscas na raiz; nunca leia `.next/`, lockfiles ou builds.
- Leia trechos de arquivos (offset/limit), não arquivos inteiros, quando souber onde está o código.
- Subagentes rodam no Haiku (`.claude/settings.json`); use-os para buscas amplas.
- Não rode `prettier` no projeto inteiro (não há configuração; reformata tudo).

## Publicação
- "Converter para main": PR para `main` e merge; o GitHub Actions gera o APK e a Release `build-<10000+N>`.
- Mudou Java ou Gradle: espere o build do branch passar antes do merge.
