// Valida el contenido descargado del bucket; jamás el MIME enviado por el navegador.
export function validarArchivo(bytes: Uint8Array, mime: string, esperado: number) {
  if (bytes.length !== esperado || bytes.length === 0 || bytes.length > 10485760) {
    throw new Error('El tamaño real del archivo no coincide o supera 10 MiB.');
  }
  const empieza = (firma: number[]) => firma.every((n, i) => bytes[i] === n);
  if (mime === 'application/pdf') {
    const inicio = new TextDecoder().decode(bytes.slice(0, 8));
    const final = new TextDecoder().decode(bytes.slice(-1024));
    if (!/^%PDF-[12]\.\d/.test(inicio) || !/%%EOF\s*$/.test(final) || bytes.length < 32) {
      throw new Error('El archivo no es un PDF completo.');
    }
  } else if (mime === 'image/jpeg') {
    if (!empieza([255, 216, 255]) || bytes.length < 20 || bytes.at(-2) !== 255 || bytes.at(-1) !== 217) {
      throw new Error('El archivo no es un JPG completo.');
    }
  } else if (mime === 'image/png') {
    if (!empieza([137, 80, 78, 71, 13, 10, 26, 10])) throw new Error('El archivo no es PNG.');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 8, primero = true, fin = false;
    while (offset + 12 <= bytes.length) {
      const size = view.getUint32(offset);
      const tipo = new TextDecoder().decode(bytes.slice(offset + 4, offset + 8));
      if (size > bytes.length - offset - 12 || (primero && (tipo !== 'IHDR' || size !== 13))) break;
      offset += size + 12;
      primero = false;
      if (tipo === 'IEND') { fin = size === 0 && offset === bytes.length; break; }
    }
    if (!fin) throw new Error('El PNG está truncado.');
  } else throw new Error('Formato no permitido.');
}
