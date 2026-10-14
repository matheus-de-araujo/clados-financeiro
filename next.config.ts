import type { NextConfig } from "next";

const config: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite"],
  outputFileTracingIncludes: {
    "/**": ["./node_modules/@electric-sql/pglite/dist/**/*"],
  },
  devIndicators: false,
  experimental: {
    // Telas já visitadas ficam guardadas no aparelho por um tempo: voltar para uma aba é imediato.
    // Qualquer lançamento chama router.refresh(), que descarta essa cópia.
    staleTimes: { dynamic: 30, static: 60 },
  },
  agentRules: false,
};

export default config;
