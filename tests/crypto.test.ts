import { beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { decrypt, encrypt } from "@/lib/crypto";

beforeAll(() => {
  process.env.PERSEUS_SECRET = randomBytes(32).toString("base64");
});

describe("crypto", () => {
  it("cifra e decifra", () => {
    const enc = encrypt("token-super-secreto");
    expect(enc).not.toContain("token");
    expect(decrypt(enc)).toBe("token-super-secreto");
  });
  it("detecta adulteração", () => {
    const [iv, tag] = encrypt("abc").split(".");
    const tampered = [iv, tag, Buffer.from("xyz").toString("base64")].join(".");
    expect(() => decrypt(tampered)).toThrow();
  });
});
