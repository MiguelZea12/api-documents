/**
 * Servicio único: login (si hace falta) + consulta + claves en var/descargas/.
 *
 *   npm run recibidos -- --anio=2026 --mes=11
 */

import logger from '../utils/logger.js';
import { parseArgsRecibidos } from '../lib/args-recibidos.js';
import { ejecutarRecibidos } from '../services/recibidos-run.service.js';

async function main() {
  const args = parseArgsRecibidos(process.argv.slice(2));

  try {
    await ejecutarRecibidos(args);
  } catch (err) {
    logger.error('Error:', err);
    process.exitCode = 1;
  }
}

main();
