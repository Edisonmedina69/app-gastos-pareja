import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarArchivo } from '../functions/comprobantes/validar.ts';

const pdf = new TextEncoder().encode('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n');
test('verificador acepta firma PDF y rechaza MIME falso, tamaño falsificado y truncados', () => {
  validarArchivo(pdf, 'application/pdf', pdf.length);
  assert.throws(() => validarArchivo(pdf, 'image/jpeg', pdf.length));
  assert.throws(() => validarArchivo(pdf, 'application/pdf', pdf.length + 1));
  assert.throws(() => validarArchivo(pdf.slice(0, -8), 'application/pdf', pdf.length - 8));
  assert.throws(() => validarArchivo(new Uint8Array(10485761), 'application/pdf', 10485761));
  assert.throws(() => validarArchivo(new Uint8Array(), 'application/pdf', 0));
});
test('verificador PNG valida firma y estructura completa de chunks', () => {
  const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jC1sAAAAASUVORK5CYII=', 'base64'));
  validarArchivo(png, 'image/png', png.length);
  assert.throws(() => validarArchivo(png.slice(0, -3), 'image/png', png.length - 3));
});
