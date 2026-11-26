import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Compone clases condicionales y resuelve conflictos de Tailwind. */
export function cn(...entradas) {
  return twMerge(clsx(entradas));
}
