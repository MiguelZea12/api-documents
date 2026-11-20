/**
 * args-emitidos.js
 * Parseo de argumentos CLI para el comando de emitidos.
 *
 * Uso:
 *   node scraper/cli/emitidos.js --anio=2026 --mes=11
 *   node scraper/cli/emitidos.js --anio=2026 --mes=11 --tipos=1,3,6
 *   node scraper/cli/emitidos.js --anio=2026 --mes=11 --estado=AUT
 */

export function parseArgsEmitidos(argv) {
  const out = {
    anio:   new Date().getFullYear(),
    mes:    new Date().getMonth() + 1,   // mes actual por defecto
    tipos:  ['1'],                       // Factura si no se indica --tipos
    estado: 'AUT',                       // Autorizados
  };

  for (const arg of argv) {
    const m = arg.match(/^--([^=]+)=(.*)$/);
    if (!m) continue;
    const [, key, val] = m;

    if (key === 'anio')   out.anio   = parseInt(val, 10);
    else if (key === 'mes')    out.mes    = parseInt(val, 10);
    else if (key === 'tipos')  out.tipos  = val.split(',').map((t) => t.trim());
    else if (key === 'estado') out.estado = val.toUpperCase();
  }

  return out;
}

export function etiquetaMes(anio, mes) {
  return `${anio}-${String(mes).padStart(2, '0')}`;
}
