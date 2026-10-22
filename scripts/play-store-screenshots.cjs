/**
 * Gera as capturas de tela da Play Store (assets/play-store/capturas/) a partir
 * do modo demonstração, com o tema Escuro: 8 telas × celular, tablet de 7" e
 * tablet de 10", com legenda (título + aviso de app não oficial) e sem.
 *
 * Uso (com o app em `vite preview` na porta 4173 e o Playwright instalado):
 *   npm run build --prefix mobile && (cd mobile && npx vite preview --port 4173 &)
 *   node scripts/play-store-screenshots.cjs
 * Variável CHROMIUM opcional: caminho do Chromium.
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const URL = process.env.APP_URL || "http://localhost:4173/";
const OUT = path.join(__dirname, "..", "assets", "play-store", "capturas");

/** Tamanho final da imagem e a largura (CSS px) da tela do app dentro dela. */
const DEVICES = {
  celular: { width: 1080, height: 1920, appWidth: 400 },
  "tablet-7": { width: 1200, height: 2134, appWidth: 560 },
  "tablet-10": { width: 1600, height: 2844, appWidth: 720 },
};

/** Telas, na ordem da página da loja. `prepare` deixa a tela no ponto da captura. */
const SCREENS = [
  { file: "01-perfil", title: "Seus troféus e platinas em um só lugar", hash: "/" },
  {
    file: "02-jogo",
    title: "Cada troféu com data e hora da conquista",
    hash: "/game/me/DEMO_GOW?service=trophy2",
    prepare: async (p) => {
      await p.locator("section button[aria-expanded]").first().click();
      await p.waitForTimeout(300);
      await p.evaluate(() => window.scrollTo(0, 420));
    },
  },
  { file: "03-estatisticas", title: "Estatísticas por plataforma e por ano", hash: "/stats" },
  { file: "04-amigos", title: "Seus amigos da PSN, online e offline", hash: "/friends" },
  { file: "05-atividades", title: "Conquistas dos amigos, com curtidas", hash: "/activity" },
  { file: "06-meritos", title: "5.000 méritos para desbloquear", hash: "/activity?view=merits" },
  {
    file: "07-boost",
    title: "Chame os amigos para o boost",
    hash: "/activity?view=boost-inbox",
    before: () => {
      const r = {
        id: "demo-pedido",
        from: "TrophyQueen",
        game: { id: "DEMO_BB", name: "Bloodborne", platform: "PS4", iconUrl: null },
        trophies: ["Caçada em grupo", "Pesadelo"],
        players: 2,
        when: "Hoje à noite",
        note: "Tenho microfone, entro às 21h",
        createdAt: new Date().toISOString(),
        receivedAt: new Date().toISOString(),
        status: "novo",
      };
      localStorage.setItem("tm.boostInbox", JSON.stringify([r]));
    },
  },
  { file: "08-loja", title: "Ofertas da loja e o menor preço já visto", hash: "/store" },
];

const FOOTER = "App não oficial · não afiliado à Sony Interactive Entertainment";

const frameHtml = (img, { width, height }, title) => {
  const u = width / 1080;
  const screenTop = title ? 330 * u : 0;
  const footer = title ? 96 * u : 0;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { margin: 0; box-sizing: border-box; }
    body { width: ${width}px; height: ${height}px; overflow: hidden; font-family: Inter, "Segoe UI", system-ui, sans-serif;
      background: radial-gradient(circle at 50% 0%, #1d3f86 0%, #0d1730 45%, #0a0d14 100%); color: #fff; position: relative; }
    h1 { position: absolute; top: ${90 * u}px; left: ${60 * u}px; right: ${60 * u}px; text-align: center;
      font-size: ${76 * u}px; line-height: 1.12; font-weight: 800; letter-spacing: -0.02em; }
    .phone { position: absolute; left: ${(title ? 96 : 0) * u}px; right: ${(title ? 96 : 0) * u}px; top: ${screenTop}px; bottom: ${footer}px;
      border-radius: ${title ? 48 * u : 0}px ${title ? 48 * u : 0}px 0 0; overflow: hidden;
      ${title ? `border: ${12 * u}px solid #1c2230; border-bottom: none; box-shadow: 0 ${20 * u}px ${60 * u}px rgba(0,0,0,.5);` : ""} }
    .phone img { width: 100%; display: block; }
    footer { position: absolute; left: 0; right: 0; bottom: 0; height: ${footer}px; display: flex; align-items: center;
      justify-content: center; background: #0a0d14; font-size: ${30 * u}px; color: #c9d2e3; font-weight: 600; }
  </style></head><body>
    ${title ? `<h1>${title}</h1>` : ""}
    <div class="phone"><img src="data:image/png;base64,${img.toString("base64")}"></div>
    ${title ? `<footer>${FOOTER}</footer>` : ""}
  </body></html>`;
};

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  for (const [device, size] of Object.entries(DEVICES)) {
    // A tela do app ocupa a área do "aparelho" na imagem com legenda; sem legenda, a imagem inteira.
    const captions = [
      ["com-legenda", true],
      ["sem-legenda", false],
    ];
    for (const [folder, withTitle] of captions) {
      const dir = path.join(OUT, folder, device);
      fs.mkdirSync(dir, { recursive: true });
      const u = size.width / 1080;
      const boxWidth = withTitle ? size.width - 2 * 96 * u - 2 * 12 * u : size.width;
      const boxHeight = withTitle ? size.height - 330 * u - 96 * u : size.height;
      const scale = boxWidth / size.appWidth;
      const viewport = { width: size.appWidth, height: Math.ceil(boxHeight / scale) };
      for (const screen of SCREENS) {
        const page = await browser.newPage({ viewport, deviceScaleFactor: scale, locale: "pt-BR" });
        await page.addInitScript(() => {
          try {
            const s = JSON.parse(localStorage.getItem("tm.settings") || "{}");
            localStorage.setItem("tm.settings", JSON.stringify({ ...s, theme: "escuro", language: "pt-BR", changelogSeen: 999, cloudNoticeSeen: true }));
          } catch {}
        });
        await page.goto(URL);
        await page.getByText("Ver demonstração").click();
        await page.waitForTimeout(1200);
        for (const name of ["Fechar", "Entendi", "OK"]) {
          const b = page.getByRole("button", { name });
          if (await b.count()) await b.first().click().catch(() => {});
        }
        if (screen.before) await page.evaluate(screen.before);
        await page.evaluate((h) => (location.hash = h), screen.hash);
        await page.waitForTimeout(2200);
        if (screen.prepare) await screen.prepare(page);
        await page.waitForTimeout(400);
        // Sem a faixa "Modo demonstração" do topo.
        await page.addStyleTag({ content: ".bg-gold\\/15 { display: none !important; }" });
        const shot = await page.screenshot({ type: "png" });
        await page.close();
        const frame = await browser.newPage({ viewport: { width: size.width, height: size.height } });
        await frame.setContent(frameHtml(shot, size, withTitle ? screen.title : null));
        await frame.waitForTimeout(150);
        await frame.screenshot({ path: path.join(dir, `${screen.file}.jpg`), type: "jpeg", quality: 92 });
        await frame.close();
      }
      console.log(folder, device, "ok");
    }
  }
  await browser.close();
})();
