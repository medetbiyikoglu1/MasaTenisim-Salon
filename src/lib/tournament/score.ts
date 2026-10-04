import type { SetScore } from "./types";

/** Tek set geçerli mi: kazanan en az 11 alır; 10-10 sonrası tam 2 fark, öncesinde kazanan tam 11. */
function validSet([a, b]: SetScore): boolean {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return false;
  const [w, l] = a > b ? [a, b] : [b, a];
  if (w < 11) return false;
  return l >= 10 ? w - l === 2 : w === 11;
}

/**
 * Maç skorunu doğrular (best of N: kazanan tam ceil(N/2) set alır, karar
 * verildikten sonra set oynanmaz). Geçersizse açıklayıcı bir hata fırlatır.
 */
export function validateMatchSets(sets: SetScore[], bestOf: number): void {
  const need = Math.ceil(bestOf / 2);
  let a = 0;
  let b = 0;
  sets.forEach((set, i) => {
    if (a === need || b === need) throw new Error(`Maç ${a}-${b} bitmişken ${i + 1}. set girilemez`);
    if (!validSet(set)) {
      throw new Error(`${i + 1}. set skoru geçersiz (${set[0]}-${set[1]}): set 11 sayıda biter, 10-10 sonrası 2 fark gerekir`);
    }
    if (set[0] > set[1]) a++;
    else b++;
  });
  if (a !== need && b !== need) throw new Error(`Maç bitmemiş (${a}-${b}): kazanan ${need} set almalı`);
}
