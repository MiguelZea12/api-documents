/**
 * index.js
 * Punto de entrada principal del servicio de scraping del SRI.
 * Inicializa el navegador, ejecuta el flujo y cierra los recursos al final.
 */

import logger from '../utils/logger.js';
import { abrirNavegador, cerrarNavegador } from '../services/navegador.service.js';
import { ejecutarFlujoSRI } from '../services/sri.service.js';

async function main() {
  logger.separador('SRI — DESCARGA MASIVA DE DOCUMENTOS ELECTRÓNICOS');
  logger.info('Iniciando servicio...');

  let browser = null;

  try {
    // 1. Abrir el navegador y obtener la página
    const { browser: b, context, page } = await abrirNavegador();
    browser = b;

    // 2. Ejecutar el flujo completo del SRI (y exportar sesión para PHP)
    await ejecutarFlujoSRI(page, context);

    // ──────────────────────────────────────────────────────────────
    // A partir de aquí puedes agregar más lógica:
    //   - Leer la tabla de comprobantes
    //   - Iterar páginas y descargar XMLs
    //   - Guardar datos en base de datos, etc.
    // ──────────────────────────────────────────────────────────────

  } catch (err) {
    logger.error('Error fatal en el proceso principal:', err);
    process.exitCode = 1;
  } finally {
    // Siempre cerrar el navegador, haya error o no
    await cerrarNavegador(browser);
    logger.info('Proceso finalizado.');
  }
}

main();
