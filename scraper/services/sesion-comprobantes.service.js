/**
 * Llega al formulario de comprobantes recibidos: sesión guardada o login completo.
 */

import config from '../config/env.js';
import logger from '../utils/logger.js';
import {
  limpiarSesionGuardada,
  sesionEsDelRucActual,
} from '../lib/sesion-storage.js';
import { ejecutarFlujoSRI } from './sri.service.js';

const BTN_BUSCAR = '#frmPrincipal\\:btnBuscar';

/**
 * @param {import('playwright').Page} page
 * @returns {Promise<boolean>}
 */
async function pantallaConsultaLista(page) {
  try {
    await page.goto(config.urls.comprobantesRecibidos, {
      waitUntil: 'networkidle',
      timeout: config.timeout,
    });

    if (page.url().includes('/auth/realms/')) {
      return false;
    }

    await page.waitForSelector(BTN_BUSCAR, { state: 'visible', timeout: 20000 });
    logger.ok('Formulario de consulta listo (sesión vigente).');
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {import('playwright').Page} page
 * @param {import('playwright').BrowserContext} context
 */
export async function asegurarPantallaConsulta(page, context) {
  const lista = await pantallaConsultaLista(page);

  if (lista && (await sesionEsDelRucActual(page))) {
    return;
  }

  if (lista) {
    logger.warn(
      `Sesión del navegador es de otro contribuyente (esperado RUC ${config.ruc}). Se hace login de nuevo...`
    );
    limpiarSesionGuardada();
    await context.clearCookies();
  }

  logger.info('Renovando sesión (login + menú hasta comprobantes recibidos)...');
  await ejecutarFlujoSRI(page, context);

  await page.waitForSelector(BTN_BUSCAR, { state: 'visible', timeout: 60000 });
  logger.ok('Formulario de consulta listo tras login.');
}
