import { describe, expect, it } from "vitest";
import {
  assignTables,
  defaultGroupCount,
  expectedScore,
  firstKnockoutRound,
  groupStandings,
  planGroupStage,
  rateMatch,
  roundRobin,
  seedOrder,
  snakeGroups,
  type QueueMatch,
} from "./index";

const players = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, elo: 2000 - i * 10 }));

describe("elo", () => {
  it("eşit puanlı oyuncularda beklenen skor 0.5", () => {
    expect(expectedScore(1500, 1500)).toBe(0.5);
  });

  it("yeni oyuncu K=40, 3-1 galibiyette 20 puan alır", () => {
    const r = rateMatch({ elo: 1500, matchesPlayed: 0 }, { elo: 1500, matchesPlayed: 0 }, [[11, 5], [8, 11], [11, 9], [11, 7]]);
    expect(r.aDelta).toBe(20);
    expect(r.bDelta).toBe(-20);
  });

  it("3-0 daha çok, 3-2 daha az puan kazandırır", () => {
    const a = { elo: 1500, matchesPlayed: 20 };
    const b = { elo: 1500, matchesPlayed: 20 };
    const sweep = rateMatch(a, b, [[11, 1], [11, 1], [11, 1]]);
    const close = rateMatch(a, b, [[11, 1], [1, 11], [11, 1], [1, 11], [11, 9]]);
    expect(sweep.aDelta).toBeGreaterThan(close.aDelta);
  });

  it("zayıf oyuncu güçlüyü yenerse daha çok puan alır", () => {
    const upset = rateMatch({ elo: 1200, matchesPlayed: 20 }, { elo: 1800, matchesPlayed: 20 }, [[11, 9], [11, 9], [9, 11], [11, 9]]);
    expect(upset.aDelta).toBeGreaterThan(15);
  });
});

describe("gruplar", () => {
  it("16 kişiye 4, 20 kişiye 5 grup önerir", () => {
    expect(defaultGroupCount(16)).toBe(4);
    expect(defaultGroupCount(20)).toBe(5);
  });

  it("yılan dizilimde en güçlü iki oyuncu aynı gruba düşmez ve gruplar dengelidir", () => {
    const groups = snakeGroups(players(20), 5);
    expect(groups.map((g) => g.length)).toEqual([4, 4, 4, 4, 4]);
    expect(groups[0].map((p) => p.id)).toEqual(["p1", "p10", "p11", "p20"]);
    expect(groups[4].map((p) => p.id)).toEqual(["p5", "p6", "p15", "p16"]);
  });

  it("4 kişilik grupta 3 tur, 6 maç; herkes herkesle bir kez oynar", () => {
    const rounds = roundRobin(["a", "b", "c", "d"]);
    expect(rounds).toHaveLength(3);
    const pairs = rounds.flat().map(([x, y]) => [x, y].sort().join(""));
    expect(new Set(pairs).size).toBe(6);
  });

  it("5×4 gruplarda 30 grup maçı üretir", () => {
    const plan = planGroupStage(snakeGroups(players(20), 5));
    expect(plan).toHaveLength(30);
    expect(plan.slice(0, 10).map((m) => m.groupIndex)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });
});

describe("sıralama", () => {
  it("üçlü eşitlikte ikili maçlardaki set oranına bakar", () => {
    const s = groupStandings(["a", "b", "c"], [
      { playerAId: "a", playerBId: "b", sets: [[11, 1], [11, 1], [11, 1]] },
      { playerAId: "b", playerBId: "c", sets: [[11, 1], [11, 1], [1, 11], [11, 1]] },
      { playerAId: "c", playerBId: "a", sets: [[11, 1], [11, 1], [1, 11], [1, 11], [11, 1]] },
    ]);
    expect(s.map((r) => r.playerId)).toEqual(["a", "c", "b"]);
    expect(s.every((r) => r.points === 3)).toBe(true);
  });
});

describe("eleme", () => {
  it("8'lik tabloda 1 ile 8, 4 ile 5 eşleşir", () => {
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
    const r = firstKnockoutRound(["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"]);
    expect(r[0]).toMatchObject({ round: "QF", playerAId: "s1", playerBId: "s8", bye: false });
  });

  it("10 kişide 2 ön eleme maçı, 6 bay çıkar", () => {
    const r = firstKnockoutRound(Array.from({ length: 10 }, (_, i) => `s${i + 1}`));
    expect(r.filter((m) => !m.bye)).toHaveLength(2);
    expect(r.filter((m) => m.bye)).toHaveLength(6);
  });
});

describe("masa kuyruğu", () => {
  const m = (id: string, order: number, a: string, b: string, groupTableId: string | null, extra: Partial<QueueMatch> = {}): QueueMatch => ({
    id, order, groupTableId, playerAId: a, playerBId: b, status: "PENDING", tableId: null, finishedAt: null, ...extra,
  });

  it("her grubun maçını kendi masasına atar", () => {
    const res = assignTables([m("1", 0, "a", "b", "T1"), m("2", 1, "c", "d", "T2")], ["T1", "T2"]);
    expect(res).toEqual([{ matchId: "1", tableId: "T1" }, { matchId: "2", tableId: "T2" }]);
  });

  it("masada olan oyuncuya ikinci maç vermez", () => {
    const res = assignTables([m("1", 0, "a", "b", null, { status: "ON_TABLE", tableId: "T1" }), m("2", 1, "a", "c", null)], ["T1", "T2"]);
    expect(res).toEqual([]);
  });

  it("az önce oynayan oyuncuyu bir maç dinlendirir", () => {
    const done = new Date("2026-12-11T20:10:00");
    const res = assignTables([
      m("1", 0, "a", "b", null, { status: "DONE", finishedAt: done }),
      m("2", 1, "a", "c", null),
      m("3", 2, "d", "e", null),
    ], ["T1"]);
    expect(res).toEqual([{ matchId: "3", tableId: "T1" }]);
  });

  it("kendi masası boşta olan grubun maçını başka masaya almaz", () => {
    const res = assignTables([m("1", 0, "a", "b", "T2")], ["T1", "T2"]);
    expect(res).toEqual([{ matchId: "1", tableId: "T2" }]);
  });
});
