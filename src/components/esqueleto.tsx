// Telas de "carregando" no formato de cada tela, para a troca de aba ser imediata.

function Osso({ w = "100%", h = 14, r = 8, className = "", escuro = false }: { w?: number | string; h?: number; r?: number; className?: string; escuro?: boolean }) {
  return <span className={`osso ${escuro ? "osso-escuro" : ""} ${className}`} style={{ width: w, height: h, borderRadius: r }} aria-hidden="true" />;
}

function Linhas({ n = 5 }: { n?: number }) {
  return (
    <div className="card">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="linha">
          <Osso w={36} h={36} r={10} />
          <span className="flex min-w-0 flex-1 flex-col gap-[6px]">
            <Osso w={`${55 + ((i * 17) % 30)}%`} h={14} />
            <Osso w={`${30 + ((i * 11) % 25)}%`} h={11} />
          </span>
          <Osso w={64} h={14} />
        </div>
      ))}
    </div>
  );
}

function Carregando({ children }: { children: React.ReactNode }) {
  return (
    <div className="esqueleto" role="status" aria-label="Carregando">
      {children}
    </div>
  );
}

/** Início da Clados ou da Casa: topo, saldo grande e o cartão verde. */
export function EsqueletoInicio() {
  return (
    <Carregando>
      <div className="flex items-center justify-between px-4 pb-2" style={{ paddingTop: "calc(16px + env(safe-area-inset-top))" }}>
        <Osso w={150} h={38} r={999} />
        <div className="flex items-center gap-2">
          <Osso w={132} h={38} r={999} />
          <Osso w={36} h={36} r={999} />
        </div>
      </div>
      <section className="px-4 pt-4">
        <Osso w={150} h={13} />
        <Osso w={210} h={44} r={10} className="mt-2" />
      </section>
      <section className="mx-4 mt-5 rounded-[18px] p-5" style={{ background: "var(--color-mata)" }}>
        <div className="flex justify-between gap-3">
          <span className="flex flex-col gap-2">
            <Osso w={150} h={16} escuro />
            <Osso w={190} h={12} escuro />
          </span>
          <Osso w={90} h={28} escuro />
        </div>
        <div className="my-4 h-px" style={{ background: "rgba(255,255,255,.12)" }} />
        <div className="flex flex-col gap-2">
          <Osso h={13} escuro />
          <Osso w="80%" h={13} escuro />
        </div>
      </section>
      <section className="sec">
        <Osso w={120} h={12} className="mb-3" />
        <Linhas n={3} />
      </section>
    </Carregando>
  );
}

/** Abas com título e lista (Contas, Cartões, Extrato, Clientes). */
export function EsqueletoLista({ titulo, seletor = false }: { titulo: string; seletor?: boolean }) {
  return (
    <Carregando>
      <header className="flex items-center justify-between gap-3 px-4" style={{ paddingTop: "calc(16px + env(safe-area-inset-top))" }}>
        <h1 className="m-0 text-[28px] font-semibold tracking-[-0.6px]">{titulo}</h1>
        {seletor ? <Osso w={132} h={38} r={999} /> : null}
      </header>
      <div className="mx-4 mt-2">
        <Osso w={190} h={14} />
      </div>
      <section className="mx-4 mt-4">
        <Linhas n={7} />
      </section>
    </Carregando>
  );
}

/** Telas que abrem por cima (lançamentos e detalhes): voltar, título e conteúdo. */
export function EsqueletoTela() {
  return (
    <Carregando>
      <header className="flex items-center gap-3 px-4" style={{ paddingTop: "calc(16px + env(safe-area-inset-top))" }}>
        <Osso w={40} h={40} r={999} />
        <span className="flex flex-1 flex-col gap-[6px]">
          <Osso w={140} h={18} />
          <Osso w={190} h={12} />
        </span>
      </header>
      <div className="mt-8 flex flex-col items-center gap-2">
        <Osso w={60} h={12} />
        <Osso w={180} h={48} r={10} />
      </div>
      <section className="mx-4 mt-8">
        <Linhas n={3} />
      </section>
    </Carregando>
  );
}
