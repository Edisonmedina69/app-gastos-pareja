import { test } from "node:test";
import assert from "node:assert";
import { formatearNumero, formatearFecha, formatearFechaCorta, obtenerFechaCierreExacta } from "./formatters.js";

test("formatearNumero should format PYG by default", () => {
  const result = formatearNumero(10000);
  assert.strictEqual(result, "10.000 Gs.");
});

test("formatearNumero should format BRL", () => {
  const result = formatearNumero(10000, "BRL");
  assert.strictEqual(result, "R$ 10.000");
});

test("formatearNumero should handle zero", () => {
  const result = formatearNumero(0);
  assert.strictEqual(result, "0 Gs.");
});

test("formatearNumero should handle null or undefined", () => {
  assert.strictEqual(formatearNumero(null), "0 Gs.");
  assert.strictEqual(formatearNumero(undefined), "0 Gs.");
  assert.strictEqual(formatearNumero(""), "0 Gs.");
});

test("formatearNumero should handle large numbers", () => {
  const result = formatearNumero(1234567.89);
  assert.ok(result.includes("Gs."));
  assert.match(result, /[0-9.,]+ Gs\./);
});

test("formatearFecha should format valid date string", () => {
  const dateStr = "2023-10-27T10:30:00";
  const result = formatearFecha(dateStr);
  assert.ok(result.length > 0);
  assert.ok(result.includes("2023"));
});

test("formatearFecha should handle empty input", () => {
  assert.strictEqual(formatearFecha(null), "");
  assert.strictEqual(formatearFecha(""), "");
});

test("formatearFechaCorta should include the year", () => {
  assert.strictEqual(formatearFechaCorta("2026-05-28"), "28 May 2026");
  assert.strictEqual(formatearFechaCorta("2025-12-05T12:00:00Z"), "5 Dic 2025");
});

test("obtenerFechaCierreExacta should compute credit card closing dates correctly", () => {
  // Due date June 5, 2026, closing day 25 -> Closing date is May 25, 2026
  assert.strictEqual(obtenerFechaCierreExacta("2026-06-05", 25), "2026-05-25");
  // Due date June 28, 2026, closing day 10 -> Closing date is June 10, 2026
  assert.strictEqual(obtenerFechaCierreExacta("2026-06-28", 10), "2026-06-10");
  // Due date March 5, 2026, closing day 31 -> Previous month is Feb, which has 28 days in 2026 -> Closing date Feb 28, 2026
  assert.strictEqual(obtenerFechaCierreExacta("2026-03-05", 31), "2026-02-28");
});

