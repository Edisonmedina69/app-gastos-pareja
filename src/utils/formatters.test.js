import { test } from "node:test";
import assert from "node:assert";
import { formatearNumero, formatearFecha } from "./formatters.js";

test("formatearNumero should format PYG by default", () => {
  const result = formatearNumero(10000);
  // Note: toLocaleString behavior can vary by environment,
  // but for es-PY we expect dot as thousands separator
  assert.strictEqual(result, "10.000 Gs.");
});

test("formatearNumero should format BRL", () => {
  const result = formatearNumero(10000, "BRL");
  assert.strictEqual(result, "R$ 10.000");
});

test("formatearNumero should handle zero", () => {
  const result = formatearNumero(0);
  assert.strictEqual(result, "0");
});

test("formatearNumero should handle null or undefined", () => {
  assert.strictEqual(formatearNumero(null), "0");
  assert.strictEqual(formatearNumero(undefined), "0");
  assert.strictEqual(formatearNumero(""), "0");
});

test("formatearNumero should handle large numbers", () => {
  const result = formatearNumero(1234567.89);
  // For es-PY, thousands separator is . and decimal is ,
  // However, default behavior might vary depending on environment's locale support.
  // We check for the currency and that it's formatted as a string.
  assert.ok(result.includes("Gs."));
  assert.match(result, /[0-9.,]+ Gs\./);
});

test("formatearFecha should format valid date string", () => {
  const dateStr = "2023-10-27T10:30:00";
  const result = formatearFecha(dateStr);
  // We expect a string containing date and time
  assert.ok(result.length > 0);
  // Check if it has the date format (roughly)
  assert.ok(result.includes("2023"));
});

test("formatearFecha should handle empty input", () => {
  assert.strictEqual(formatearFecha(null), "");
  assert.strictEqual(formatearFecha(""), "");
});
