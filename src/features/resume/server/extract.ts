import "server-only";
import { createLogger } from "@/lib/logger";

const log = createLogger("resume:extract");

export const RESUME_MAX_BYTES = 5 * 1024 * 1024;
export const RESUME_ALLOWED_TYPES = ["application/pdf", "text/plain"] as const;

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46]; // %PDF

/** Vérifie la signature binaire (magic bytes) : ne fait pas confiance au type MIME déclaré. */
export function sniffResumeType(bytes: Uint8Array): "application/pdf" | "text/plain" | null {
  if (bytes.length >= 4 && PDF_MAGIC.every((b, i) => bytes[i] === b)) return "application/pdf";
  // Texte brut : uniquement des octets imprimables / espaces sur le premier Ko
  const sample = bytes.subarray(0, 1024);
  let printable = 0;
  for (const b of sample) if (b === 9 || b === 10 || b === 13 || (b >= 32 && b !== 127)) printable++;
  if (sample.length > 0 && printable / sample.length > 0.95) return "text/plain";
  return null;
}

/** Extrait le texte d'un fichier CV (PDF via unpdf, ou texte brut). */
export async function extractResumeText(bytes: Uint8Array, type: "application/pdf" | "text/plain"): Promise<string> {
  if (type === "text/plain") return new TextDecoder("utf-8").decode(bytes);
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    return typeof text === "string" ? text : (text as string[]).join("\n");
  } catch (error) {
    log.error("Extraction PDF échouée", error);
    throw new Error("Impossible de lire ce PDF. Vérifie qu'il n'est pas protégé ou scanné en image.");
  }
}
