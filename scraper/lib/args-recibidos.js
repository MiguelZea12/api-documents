/**
 * Argumentos CLI compartidos (un mes, rango de meses, día, tipo).
 */

export function parseArgsRecibidos(argv) {
  const out = {
    anio: new Date().getFullYear(),
    mes: null,
    mesDesde: null,
    mesHasta: null,
    dia: 0,
    tipo: '1',
  };

  for (const arg of argv) {
    const m = arg.match(/^--([^=]+)=(.*)$/);
    if (!m) continue;
    const [, key, val] = m;
    if (key === 'anio') out.anio = parseInt(val, 10);
    else if (key === 'mes') out.mes = parseInt(val, 10);
    else if (key === 'mes-desde') out.mesDesde = parseInt(val, 10);
    else if (key === 'mes-hasta') out.mesHasta = parseInt(val, 10);
    else if (key === 'dia') out.dia = parseInt(val, 10);
    else if (key === 'tipo') out.tipo = val;
  }

  return out;
}

export function etiquetaPeriodo(anio, mes, mesDesde, mesHasta) {
  if (mes !== null) return `${anio}-${String(mes).padStart(2, '0')}`;
  const d = mesDesde ?? 1;
  const h = mesHasta ?? 12;
  return `${anio}-${String(d).padStart(2, '0')}_${String(h).padStart(2, '0')}`;
}

/** Carpeta de salida de un mes concreto (p. ej. 2026-09). */
export function etiquetaMes(anio, mes) {
  return `${anio}-${String(mes).padStart(2, '0')}`;
}
