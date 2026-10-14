// Aplica as migrações no Postgres do Neon (DATABASE_URL).
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

if (!process.env.DATABASE_URL) throw new Error("Defina DATABASE_URL");
const db = drizzle(neon(process.env.DATABASE_URL));
await migrate(db, { migrationsFolder: "drizzle" });
console.log("Migrações aplicadas");
