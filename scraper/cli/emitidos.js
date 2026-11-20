/**
 * CLI — Comprobantes electrónicos emitidos
 *
 * Uso:
 *   npm run emitidos -- --mes=11              (solo Factura por defecto)
 *   npm run emitidos -- --anio=2026 --mes=10
 *   npm run emitidos -- --anio=2026 --mes=11 --tipos=1,6
 *   npm run emitidos -- --anio=2026 --mes=11 --estado=AUT
 *
 * Tipos: 1=Factura  2=Liquidación  3=Nota Crédito  4=Nota Débito
 *        5=Guía Remisión  6=Retención
 * Estado: AUT=Autorizados  NAT=No Autorizados  PPR=Por Procesar
 */

import logger              from '../utils/logger.js';
import { parseArgsEmitidos } from '../lib/args-emitidos.js';
import { ejecutarEmitidos }  from '../services/emitidos-run.service.js';

async function main() {
  const args = parseArgsEmitidos(process.argv.slice(2));

  try {
    await ejecutarEmitidos(args);
  } catch (err) {
    logger.error('Error ejecutando emitidos:', err);
    process.exitCode = 1;
  }
}

main();
