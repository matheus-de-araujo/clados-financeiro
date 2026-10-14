// Copia o SQL das migrações para um módulo TS, para o banco em memória (demonstração e testes)
// conseguir criar as tabelas sem ler arquivos em tempo de execução.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const dir = new URL("../drizzle/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const statements = files.flatMap((f) =>
  readFileSync(new URL(f, dir), "utf8")
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean),
);
writeFileSync(
  new URL("../src/db/migrations.generated.ts", import.meta.url),
  `// Gerado por scripts/embed-migrations.mjs. Não edite à mão.\nexport const MIGRATIONS: string[] = ${JSON.stringify(statements, null, 2)};\n`,
);
console.log(`${statements.length} comandos de ${files.length} migração(ões)`);
