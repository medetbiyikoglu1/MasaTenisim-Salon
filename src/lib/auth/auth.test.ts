import { describe, expect, it } from "vitest";
import { accessFor } from "./access";
import { randomToken, sha256, sign, verify } from "./token";

describe("imzalı çerez", () => {
  it("doğru imzayı kabul eder, değiştirilmiş değeri ve yanlış anahtarı reddeder", async () => {
    const v = await sign("oyuncu:abc", "gizli");
    expect(await verify(v, "gizli")).toBe("oyuncu:abc");
    expect(await verify(v.replace("abc", "xyz"), "gizli")).toBeNull();
    expect(await verify(v, "baska")).toBeNull();
    expect(await verify("bozuk", "gizli")).toBeNull();
    expect(await verify(undefined, "gizli")).toBeNull();
  });

  it("rastgele anahtarlar farklı, özet sabit", async () => {
    expect(randomToken()).not.toBe(randomToken());
    expect(await sha256("a")).toBe(await sha256("a"));
  });
});

describe("erişim kuralları", () => {
  it("salon ekranı ve giriş sayfaları herkese açık", () => {
    expect(accessFor("/tv/abc", "GET", "guest")).toBe("allow");
    expect(accessFor("/giris", "POST", "guest")).toBe("allow");
    expect(accessFor("/oyuncu/giris/tok", "GET", "guest")).toBe("allow");
  });

  it("girişsiz kullanıcı yönetim ve oyuncu sayfalarına giremez", () => {
    expect(accessFor("/", "GET", "guest")).toBe("login");
    expect(accessFor("/turnuvalar/yeni", "GET", "guest")).toBe("login");
    expect(accessFor("/oyuncu", "GET", "guest")).toBe("allow"); // sayfa kendisi "bağlantı iste" der
  });

  it("oyuncu turnuva oluşturamaz, sonuç giremez, masaları göremez; sadece görüntüler", () => {
    expect(accessFor("/turnuvalar/yeni", "GET", "player")).toBe("player-home");
    expect(accessFor("/turnuvalar/t1/mac/m1", "GET", "player")).toBe("player-home");
    expect(accessFor("/turnuvalar/t1", "POST", "player")).toBe("allow"); // katıl/çekil; yönetici işlemleri ayrıca korunur
    expect(accessFor("/turnuvalar/yeni", "POST", "player")).toBe("player-home");
    expect(accessFor("/masalar", "GET", "player")).toBe("player-home");
    expect(accessFor("/maclar", "GET", "player")).toBe("player-home");
    expect(accessFor("/", "GET", "player")).toBe("player-home");
    expect(accessFor("/turnuvalar/t1", "GET", "player")).toBe("allow");
    expect(accessFor("/oyuncular", "GET", "player")).toBe("allow");
    expect(accessFor("/oyuncular", "POST", "player")).toBe("player-home");
    expect(accessFor("/oyuncu", "POST", "player")).toBe("allow");
  });

  it("salon sahibi her yere girer", () => {
    expect(accessFor("/turnuvalar/yeni", "POST", "admin")).toBe("allow");
    expect(accessFor("/masalar/x", "GET", "admin")).toBe("allow");
  });
});
