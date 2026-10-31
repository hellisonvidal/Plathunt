import { describe, expect, it } from "vitest";
import { evaluateRelease, parseBuildTag, RELEASES_PAGE } from "../src/lib/updates";

describe("parseBuildTag", () => {
  it("lê o número do build", () => {
    expect(parseBuildTag("build-42")).toBe(42);
    expect(parseBuildTag("v1.1.1-build-3")).toBe(3);
    expect(parseBuildTag("v1.0")).toBeNull();
    expect(parseBuildTag(undefined)).toBeNull();
  });
});

describe("evaluateRelease", () => {
  const release = {
    tag_name: "build-12",
    body: "Novidades",
    assets: [{ name: "Plathunt.apk", browser_download_url: "https://x/app.apk" }],
  };

  it("avisa quando há build mais novo, com o link do APK", () => {
    expect(evaluateRelease(release, "10")).toEqual({
      status: "available",
      latest: 12,
      apkUrl: "https://x/app.apk",
      notes: "Novidades",
      label: "build 12",
    });
  });

  it("está em dia quando o build instalado é igual ou maior", () => {
    expect(evaluateRelease(release, "12")).toEqual({ status: "up-to-date", latest: 12 });
    expect(evaluateRelease(release, "13").status).toBe("up-to-date");
  });

  it("build de desenvolvimento sempre vê a versão publicada", () => {
    expect(evaluateRelease(release, "dev").status).toBe("available");
  });

  it("sem APK anexado, aponta para a página de versões", () => {
    expect(evaluateRelease({ tag_name: "build-3" }, "1")).toMatchObject({ apkUrl: RELEASES_PAGE });
  });

  it("tag desconhecida não quebra", () => {
    expect(evaluateRelease({ tag_name: "v2" }, "1").status).toBe("unavailable");
  });
});

describe("numeração 1.1.1 (versionCode = 10000 + build)", () => {
  const release = {
    tag_name: "build-10004",
    name: "Plathunt 1.1.1 (build 4)",
    assets: [{ name: "Plathunt.apk", browser_download_url: "https://x/app.apk" }],
  };

  it("o app antigo (build 147) enxerga a versão nova e instala por cima", () => {
    expect(evaluateRelease(release, "147")).toMatchObject({ status: "available", latest: 10004, label: "1.1.1" });
  });

  it("a versão nova não se oferece para si mesma", () => {
    expect(evaluateRelease(release, "10004").status).toBe("up-to-date");
  });
});
