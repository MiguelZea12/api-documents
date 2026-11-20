/**
 * var/descargas/{ruc}/{recibidos|emitidos}/{YYYY-MM}/
 */

import path from 'path';
import config from '../config/env.js';

function segmentoRuc() {
  const d = String(config.ruc ?? '').replace(/\D/g, '');
  return d || 'sin-ruc';
}

/**
 * @param {'recibidos'|'emitidos'} tipo
 * @param {string} periodo  ej. 2026-10 o 2026-09_11
 */
export function dirDescarga(tipo, periodo) {
  if (tipo !== 'recibidos' && tipo !== 'emitidos') {
    throw new Error('tipo debe ser recibidos o emitidos');
  }
  const limpio = String(periodo).replace(/\.\./g, '').replace(/\\/g, '/');

  return path.resolve('./var/descargas', segmentoRuc(), tipo, limpio);
}
