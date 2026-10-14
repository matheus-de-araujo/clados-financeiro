"use client";

import { useState } from "react";

export function CopiarMensagem({ texto }: { texto: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      className="pill p-linha"
      style={{ height: 44 }}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setOk(true);
          setTimeout(() => setOk(false), 1600);
        } catch {}
      }}
    >
      {ok ? "Copiado" : "Copiar"}
    </button>
  );
}
