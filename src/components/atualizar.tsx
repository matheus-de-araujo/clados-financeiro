"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Quando o app volta para a frente depois de um tempo em segundo plano, busca os números de novo.
 * No iPhone o PWA não tem "puxar para atualizar", e a outra pessoa pode ter lançado algo nesse meio tempo.
 */
export function AtualizarAoVoltar({ depoisDe = 30_000 }: { depoisDe?: number }) {
  const router = useRouter();
  useEffect(() => {
    let saiuEm = 0;
    const mudou = () => {
      if (document.visibilityState === "hidden") saiuEm = Date.now();
      else if (saiuEm && Date.now() - saiuEm > depoisDe) router.refresh();
    };
    document.addEventListener("visibilitychange", mudou);
    return () => document.removeEventListener("visibilitychange", mudou);
  }, [router, depoisDe]);
  return null;
}
