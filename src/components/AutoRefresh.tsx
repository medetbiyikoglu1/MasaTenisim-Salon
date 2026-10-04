"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** Sunucu verisini belirli aralıklarla tazeler (sayfa yeniden yüklenmeden). */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}

export function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="tabular-nums">{now?.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) ?? ""}</span>;
}
