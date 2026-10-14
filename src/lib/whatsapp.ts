import { brl, type Cents } from "./money";
import { ddmm, type ISODate } from "./dates";

export function mensagemCobranca(cliente: string, descricao: string, valor: Cents, vencimento?: ISODate): string {
  const venc = vencimento ? `, que venceu em ${ddmm(vencimento)}` : "";
  return `Olá, ${cliente.split(" ")[0]}! Tudo bem? Segue a cobrança de ${descricao.toLowerCase()} (${brl(valor)})${venc}. Qualquer dúvida, é só falar. Obrigado! Clados Tecnologia`;
}

export function linkWhatsApp(telefone: string | null | undefined, texto: string): string {
  const fone = (telefone ?? "").replace(/\D/g, "");
  return `https://wa.me/${fone}?text=${encodeURIComponent(texto)}`;
}
