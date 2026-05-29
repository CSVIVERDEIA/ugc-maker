import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Arquivos do Replicate exigem auth. Para exibir no navegador, passa pelo proxy
 * /api/file. URLs públicas (blob:, http externo) passam direto.
 */
export function proxiedSrc(src) {
  if (typeof src === "string" && src.startsWith("https://api.replicate.com/v1/files/")) {
    return `/api/file?url=${encodeURIComponent(src)}`;
  }
  return src;
}
