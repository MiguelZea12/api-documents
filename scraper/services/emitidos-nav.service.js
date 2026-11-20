/**
 * emitidos-nav.service.js
 * Navega desde el portal Angular (ya logueado) hasta
 * "Comprobantes electrónicos emitidos":
 *
 *   Facturación Electrónica
 *     → Producción  (acordeón, fa-caret-right → caret-down)
 *       → Consultas  (redireccion=60&idGrupo=58)
 *         → Comprobantes electrónicos emitidos  (consultaDocumentoForm:j_idt22)
 */

import config from '../config/env.js';
import logger from '../utils/logger.js';
import { capturarPantalla } from './navegador.service.js';
import { expandirModuloFacturacion } from './sri.service.js';

// ─── URLs del módulo emitidos ─────────────────────────────────────────────────
const URL_CONSULTAS_PRODUCCION =
  'https://srienlinea.sri.gob.ec/tuportal-internet/accederAplicacion.jspa?redireccion=60&idGrupo=58';

const URL_EMITIDOS_JSF_RE = /comprobantesEmitidos\.jsf/i;

// ─── Selectores / texto ───────────────────────────────────────────────────────
const TXT_PRODUCCION = /^producci[oó]n$/i;
const TXT_CONSULTAS = /^consultas$/i;
const TXT_EMITIDOS = /comprobantes\s+electr[oó]nicos\s+emitidos/i;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Busca y hace clic en un <a> o <li> cuyo texto visible coincida con el patrón.
 * @param {import('playwright').Page} page
 * @param {RegExp} patron
 * @param {string} etiqueta  (para logs)
 * @param {number} [timeout]
 * @returns {Promise<boolean>}
 */
async function clicPorTexto(page, patron, etiqueta, timeout = 15000) {
  const loc = page.locator('a, span.ui-menuitem-text').filter({ hasText: patron });

  const n = await loc.count();
  if (n === 0) {
    logger.warn(`No se encontró "${etiqueta}" en DOM`);
    return false;
  }

  const visible = await loc.first().isVisible().catch(() => false);
  if (visible) {
    logger.paso('NAV', `Clic en "${etiqueta}"`);
    await loc.first().click();
  } else {
    logger.paso('NAV', `"${etiqueta}" en DOM (no visible); clic forzado`);
    await loc.first().click({ force: true });
  }

  await page.waitForTimeout(1200);
  return true;
}

/**
 * Expande el acordeón "Producción" si no estaba abierto.
 * Se distingue por la clase del icono: fa-caret-right (cerrado) → fa-caret-down (abierto).
 */
async function expandirProduccion(page) {
  logger.paso('NAV', 'Buscando ítem "Producción"...');

  const itemProduccion = page
    .locator('li')
    .filter({ has: page.locator('span.ui-menuitem-text', { hasText: TXT_PRODUCCION }) })
    .first();

  if ((await itemProduccion.count()) === 0) {
    // No está en DOM: puede que Facturación no esté expandida todavía
    logger.warn('"Producción" no está en DOM; reintentando expansión de Facturación...');
    return false;
  }

  // ¿Ya está expandido? (icono tiene fa-caret-down)
  const yaAbierto = await itemProduccion
    .locator('span.fa-caret-down')
    .isVisible()
    .catch(() => false);

  if (yaAbierto) {
    logger.ok('"Producción" ya expandido.');
    return true;
  }

  logger.paso('NAV', 'Clic en "Producción" para expandir...');
  const link = itemProduccion.locator('a').first();
  await link.click();
  await page.waitForTimeout(1500);

  return true;
}

/**
 * Navega al portal de Consultas de Producción (tuportal-internet → JSF).
 * El clic en "Consultas" redirige a:
 *   tuportal → accederAplicacion.jspa?redireccion=60&idGrupo=58
 *   → luego a /comprobantes-electronicos-internet/pages/consultas/emitidos/
 */
async function irAConsultasProduccion(page) {
  logger.separador('PASO — CONSULTAS (Producción)');

  // Clic en enlace "Consultas" dentro del acordeón Producción
  const enlaceConsultas = page
    .locator(`a[href*="redireccion=60"][href*="idGrupo=58"]`)
    .first();

  const estaEnDom = (await enlaceConsultas.count()) > 0;

  if (estaEnDom) {
    logger.paso('NAV', 'Clic en "Consultas" (href redireccion=60)');
    const navP = page.waitForURL(/tuportal-internet|comprobantesEmitidos/i, {
      waitUntil: 'networkidle',
      timeout: config.timeout,
    }).catch(() => {});
    await enlaceConsultas.click();
    await navP;
  } else {
    // Fallback: navegar directamente
    logger.warn('"Consultas" no está en DOM; navegando a URL directa...');
    await page.goto(URL_CONSULTAS_PRODUCCION, {
      waitUntil: 'networkidle',
      timeout: config.timeout,
    });
  }

  await page.waitForTimeout(1500);
  logger.ok(`URL tras Consultas: ${page.url()}`);
}

/**
 * Desde la pantalla de Consultas (tuportal), clic en
 * "Comprobantes electrónicos emitidos".
 */
async function irAComprobantesEmitidosEnLista(page) {
  logger.separador('PASO — COMPROBANTES ELECTRÓNICOS EMITIDOS');

  // Selector por texto (igual que en imagen 4)
  const enlaceEmitidos = page
    .locator('a')
    .filter({ hasText: TXT_EMITIDOS })
    .first();

  await enlaceEmitidos
    .waitFor({ state: 'visible', timeout: config.timeout })
    .catch(async () => {
      logger.warn('Enlace emitidos no visible; buscando en DOM...');
      await enlaceEmitidos.waitFor({ state: 'attached', timeout: 10000 });
    });

  logger.paso('NAV', 'Clic en "Comprobantes electrónicos emitidos"');

  const navP = page
    .waitForURL(URL_EMITIDOS_JSF_RE, { waitUntil: 'networkidle', timeout: config.timeout })
    .catch(() => {});

  const visible = await enlaceEmitidos.isVisible().catch(() => false);
  if (visible) {
    await Promise.all([navP, enlaceEmitidos.click()]);
  } else {
    // Clic por evaluate (mojarra.jsfcljs)
    logger.paso('NAV', 'Clic forzado vía DOM en emitidos...');
    await page.evaluate((txt) => {
      const a = Array.from(document.querySelectorAll('a')).find((el) =>
        el.textContent?.trim().match(new RegExp(txt, 'i'))
      );
      if (a) a.click();
    }, 'Comprobantes electr[oó]nicos emitidos');
    await navP;
  }

  await page.waitForTimeout(1500);
}

// ─── Función principal exportada ─────────────────────────────────────────────

/**
 * Desde la sesión activa (ya logueado en el portal Angular):
 *   1. Expande "Facturación Electrónica"
 *   2. Expande "Producción"
 *   3. Clic en "Consultas"
 *   4. Clic en "Comprobantes electrónicos emitidos"
 *   5. Espera a que cargue comprobantesEmitidos.jsf
 *
 * @param {import('playwright').Page} page
 * @param {import('playwright').BrowserContext} context
 */
export async function irAModuloEmitidos(page, context) {
  // ── 1. Facturación Electrónica ───────────────────────────────────────────
  await expandirModuloFacturacion(page);

  // ── 2. Producción ────────────────────────────────────────────────────────
  const produccionOk = await expandirProduccion(page);
  if (!produccionOk) {
    // Puede que Facturación haya cargado el menú pero Producción esté en otro panel
    await page.waitForTimeout(2000);
    await expandirProduccion(page);
  }

  // ── 3. Consultas (redireccion=60) ────────────────────────────────────────
  await irAConsultasProduccion(page);

  // ── 4. Comprobantes emitidos ─────────────────────────────────────────────
  if (!page.url().match(URL_EMITIDOS_JSF_RE)) {
    await irAComprobantesEmitidosEnLista(page);
  }

  // ── 5. Verificar llegada ─────────────────────────────────────────────────
  if (!page.url().match(URL_EMITIDOS_JSF_RE)) {
    await page
      .waitForURL(URL_EMITIDOS_JSF_RE, { waitUntil: 'networkidle', timeout: config.timeout })
      .catch(() => logger.warn('No confirmó URL comprobantesEmitidos.jsf; se continúa.'));
  }

  const urlFinal = page.url();
  if (urlFinal.includes('/auth/realms/')) {
    throw new Error('El portal redirigió al login al abrir emitidos.');
  }

  logger.ok(`Módulo emitidos cargado → ${urlFinal}`);
  await capturarPantalla(page, 'comprobantes_emitidos');
  logger.ok('Captura guardada en var/capturas/');
}
