/**
 * Prueba de navegación: llega hasta "Comprobantes electrónicos emitidos".
 *   npm run ir-emitidos
 */

import config from '../config/env.js';
import logger from '../utils/logger.js';
import { abrirNavegadorConSesion, cerrarNavegador } from '../services/navegador.service.js';
import { irAModuloEmitidos } from '../services/emitidos-nav.service.js';
import {
  iniciarSesion,
  esperarPortalCargado,
  abrirMenuLateral,
} from '../services/sri.service.js';

async function asegurarPortalActivo(page) {
  await page.goto(config.urls.perfilContribuyente, {
    waitUntil: 'networkidle',
    timeout: config.timeout,
  });

  if (page.url().includes('/auth/realms/')) {
    logger.info('Sesión expirada; login completo...');
    await iniciarSesion(page);
    await esperarPortalCargado(page);
  } else {
    logger.ok('Sesión vigente en el portal.');
    await page.waitForTimeout(2000);
  }

  await abrirMenuLateral(page);
}

async function main() {
  let browser = null;

  try {
    const { browser: b, page, context } = await abrirNavegadorConSesion();
    browser = b;

    await asegurarPortalActivo(page);
    await irAModuloEmitidos(page, context);

    logger.separador();
    logger.ok('✅ Se llegó a "Comprobantes electrónicos emitidos".');
    logger.info('Siguiente: implementar consulta por día.');
    logger.separador();

    await page.waitForTimeout(5000);
  } catch (err) {
    logger.error('Error en la navegación a emitidos:', err);
    process.exitCode = 1;
  } finally {
    await cerrarNavegador(browser);
  }
}

main();
