/**
 * sri.service.js
 * Orquesta la navegación dentro del portal SRI en Línea:
 *   1. Login  →  /sri-en-linea/contribuyente/perfil (Angular)
 *   2. Abrir menú:
 *        - Angular: panel con texto "FACTURACIÓN ELECTRÓNICA" (sin hamburguesa topbar)
 *        - Legacy:  icono colapsado Facturación  →  #menuNuevo (o hamburguesa)
 *   3. Un clic en Facturación Electrónica
 *   4. Clic en Comprobantes electrónicos recibidos
 */

import fs from 'fs/promises';
import path from 'path';
import config from '../config/env.js';
import logger from '../utils/logger.js';
import { capturarPantalla } from './navegador.service.js';
import { exportarSesionConMeta } from '../lib/sesion-storage.js';

// ─── Selectores del portal SRI ────────────────────────────────────────────────
const SELECTOR = {
  campoRuc:   '#usuario',
  campoClave: '#password',
  botonLogin: '#kc-login',

  // Legacy (topbar + barra colapsada de iconos)
  // Hamburguesa barra superior (visible en /contribuyente/perfil)
  btnHamburguesaTopbar: [
    'a.top-icono-menu',
    '.div-boton-legado a.top-icono-menu',
    '.topbar a[onclick*="mostrarOcultaSidebar"]',
    '.topbar .div-boton-legado a',
    'span.sri-menu-icon-menu-hamburguesa',
  ].join(', '),

  btnHamburguesaLegacy: [
    'a[href="javascript:mostrarOcultaSidebar();"]',
    '#menuNuevo-colapsado a[href*="mostrarOcultaSidebar"]',
  ].join(', '),

  menuExpandido:   '#menuNuevo.mostrarMenu',
  menuColapsado:   '#menuNuevo-colapsado',
  menuFacturacionLegacy: '#sri-menu-icon-facturacion-electronica',

  // Barra colapsada: el <a> ejecuta clic('sri-menu-icon-facturacion-electronica')
  iconoFacturacionColapsado: [
    '#menuNuevo-colapsado a:has(.sri-menu-icon-facturacion-electronica)',
    '#menuNuevo-colapsado span.sri-menu-icon-facturacion-electronica',
    'span.sri-menu-icon-facturacion-electronica[title*="Facturaci"]',
    '.sri-menu-icon-facturacion-electronica',
  ].join(', '),

  // Enlace real detectado en diagnóstico (portal Angular)
  submenuComprobantes: 'a[href*="redireccion=57"][href*="idGrupo=55"]',
};
// ─────────────────────────────────────────────────────────────────────────────

/** Locator del acordeón "FACTURACIÓN ELECTRÓNICA" en el menú Angular. */
function locatorFacturacionElectronica(page) {
  return page
    .locator('a')
    .filter({ hasText: /^FACTURACI[ÓO]N\s+ELECTR[ÓO]NICA$/i });
}

/** Locator del ítem "Comprobantes electrónicos recibidos". */
function locatorComprobantesRecibidos(page) {
  return page
    .locator(SELECTOR.submenuComprobantes)
    .filter({ hasText: /comprobantes electr[oó]nicos recibidos/i })
    .first();
}

/** ¿Estamos en el portal Angular (post-login)? */
function esPortalAngular(page) {
  return page.url().includes('/sri-en-linea/');
}

/** ¿Menú legacy ya expandido (#menuNuevo con textos)? */
async function menuLegacyExpandido(page) {
  const menu = page.locator(SELECTOR.menuExpandido);
  return menu.isVisible().catch(() => false);
}

/**
 * Clic en el icono de Facturación Electrónica (menú colapsado).
 * Abre el panel #menuNuevo igual que la hamburguesa.
 * @returns {Promise<boolean>}
 */
async function clicIconoFacturacionColapsado(page) {
  const candidatos = SELECTOR.iconoFacturacionColapsado.split(',').map((s) => s.trim());

  for (const sel of candidatos) {
    const el = page.locator(sel).first();
    if ((await el.count()) === 0) continue;

    const visible = await el.isVisible().catch(() => false);
    if (!visible) continue;

    logger.paso('MENÚ', `Clic en icono colapsado Facturación (${sel})...`);
  // Clic en el <a> padre si apuntamos al span
    const clicTarget =
      sel.includes('span') ? el.locator('xpath=ancestor::a[1]').first() : el;
    const target = (await clicTarget.count()) > 0 ? clicTarget : el;
    await target.click();
    await page.waitForTimeout(1000);
    return true;
  }

  logger.paso('MENÚ', 'Invocando clic("sri-menu-icon-facturacion-electronica") en JS...');
  return page.evaluate(() => {
    if (typeof clic === 'function') {
      clic('sri-menu-icon-facturacion-electronica');
      return true;
    }
    return false;
  });
}

/** Espera a que el menú expandido o el ítem de facturación sea interactuable. */
async function esperarMenuListo(page) {
  return Promise.race([
    page.locator(SELECTOR.menuExpandido).waitFor({ state: 'visible', timeout: config.timeout }),
    page.locator(SELECTOR.menuFacturacionLegacy).waitFor({ state: 'visible', timeout: config.timeout }),
    locatorFacturacionElectronica(page).first().waitFor({ state: 'visible', timeout: config.timeout }),
  ]).then(() => true).catch(() => false);
}

/** Clic programático en un enlace por texto exacto o por parte del href. */
async function clicEnlaceEnDom(page, { textoExacto, hrefContiene }) {
  return page.evaluate(
    ({ textoExacto, hrefContiene }) => {
      const enlaces = Array.from(document.querySelectorAll('a'));
      const encontrado = enlaces.find((a) => {
        const texto = (a.innerText || a.textContent || '').trim().replace(/\s+/g, ' ');
        const href = a.getAttribute('href') || '';
        if (textoExacto && texto.toUpperCase() === textoExacto.toUpperCase()) return true;
        if (hrefContiene && href.includes(hrefContiene)) return true;
        return false;
      });
      if (!encontrado) return false;
      encontrado.click();
      return true;
    },
    { textoExacto, hrefContiene }
  );
}

/** Intenta abrir el menú lateral en la pantalla de perfil Angular (post-login). */
async function abrirMenuEnPerfilAngular(page) {
  logger.paso('MENÚ', 'Pantalla /contribuyente/perfil: probando hamburguesa del topbar...');

  const candidatos = SELECTOR.btnHamburguesaTopbar.split(',').map((s) => s.trim());
  for (const sel of candidatos) {
    const el = page.locator(sel).first();
    if (!(await el.isVisible().catch(() => false))) continue;

    logger.paso('MENÚ', `Clic hamburguesa topbar (${sel})...`);
    await el.click();
    await page.waitForTimeout(1500);

    const abierto = await page
      .getByText(/FACTURACI[ÓO]N\s+ELECTR[ÓO]NICA/i)
      .first()
      .isVisible()
      .catch(() => false);

    if (abierto) {
      logger.ok('Menú de textos visible tras hamburguesa.');
      return true;
    }
  }

  // El menú completo suele estar oculto pero presente en el DOM
  const enDom = await page.locator(SELECTOR.submenuComprobantes).count();
  if (enDom > 0) {
    logger.ok('Enlaces del menú en DOM (panel oculto); se continúa con clics directos.');
    return true;
  }

  return false;
}

/** Intenta hacer clic en la hamburguesa legacy (varios selectores). */
async function clicHamburguesaLegacy(page) {
  const candidatos = SELECTOR.btnHamburguesaLegacy.split(',').map((s) => s.trim());

  for (const sel of candidatos) {
    const el = page.locator(sel).first();
    const visible = await el.isVisible().catch(() => false);
    if (!visible) continue;

    logger.paso('MENÚ', `Clic en hamburguesa (${sel})...`);
    await el.click();
    return true;
  }

  logger.paso('MENÚ', 'Invocando mostrarOcultaSidebar() por JavaScript...');
  await page.evaluate(() => {
    if (typeof mostrarOcultaSidebar === 'function') mostrarOcultaSidebar();
  });
  return false;
}

/**
 * PASO 1: Inicio de sesión en el portal SRI.
 * @param {import('playwright').Page} page
 */
export async function iniciarSesion(page) {
  logger.separador('PASO 1 — LOGIN');
  logger.paso('LOGIN', 'Navegando a la página de inicio de sesión...');

  await page.goto(config.urls.login);
  await page.waitForLoadState('networkidle');

  logger.paso('LOGIN', `Ingresando RUC: ${config.ruc}`);
  await page.fill(SELECTOR.campoRuc, config.ruc);

  logger.paso('LOGIN', 'Ingresando contraseña...');
  await page.fill(SELECTOR.campoClave, config.clave);

  logger.paso('LOGIN', 'Haciendo clic en "Iniciar Sesión"...');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }),
    page.click(SELECTOR.botonLogin),
  ]);

  const urlActual = page.url();
  if (urlActual.includes('/auth/realms/')) {
    const mensajeError = await page
      .locator('.alert-error, #input-error, .kc-feedback-text')
      .textContent()
      .catch(() => 'Credenciales incorrectas o error desconocido');
    throw new Error(`Login fallido: ${mensajeError.trim()}`);
  }

  logger.ok(`Login exitoso → ${urlActual}`);
}

/**
 * Espera a que el portal Angular termine de cargar tras el redirect OAuth (#code=...).
 * @param {import('playwright').Page} page
 */
export async function esperarPortalCargado(page) {
  logger.separador('CARGA DEL PORTAL');
  logger.paso('CARGA', 'Esperando fin del redirect OAuth (#state / #code en la URL)...');

  await page
    .getByText('Espere por favor', { exact: false })
    .waitFor({ state: 'hidden', timeout: config.timeout })
    .catch(() => logger.warn('No apareció "Espere por favor", continuamos.'));

  // Angular intercambia el code del hash por la sesión
  await page
    .getByText(config.ruc, { exact: false })
    .first()
    .waitFor({ state: 'visible', timeout: config.timeout });

  await page.waitForLoadState('networkidle').catch(() => {});

  const url = page.url();
  if (!url.includes('/contribuyente/perfil') && !url.includes('/sri-en-linea/')) {
    logger.warn(`URL inesperada tras login: ${url}`);
  } else {
    logger.ok(`Sesión activa en: ${url.split('#')[0]}`);
  }

  logger.paso(
    'CARGA',
    `Espera de ${config.esperaPostLoginMs}ms para que cargue el menú lateral...`
  );
  await page.waitForTimeout(config.esperaPostLoginMs);
}

/**
 * Cierra el diálogo de validación de navegador si aparece.
 * @param {import('playwright').Page} page
 */
async function cerrarAvisoNavegadorSiExiste(page) {
  const btn = page.getByRole('button', { name: /continuar navegando/i });
  if (await btn.isVisible().catch(() => false)) {
    logger.paso('AVISO', 'Cerrando diálogo de validación de navegador...');
    await btn.click();
  }
}

/**
 * PASO 2: Abre el menú lateral.
 * Portal Angular: no hay hamburguesa topbar; el acordeón ya está en el DOM.
 * Portal legacy: cerrado = #menuNuevo-colapsado → hamburguesa → #menuNuevo.
 *
 * @param {import('playwright').Page} page
 */
export async function abrirMenuLateral(page) {
  logger.separador('PASO 2 — MENÚ LATERAL');

  if (await menuLegacyExpandido(page)) {
    logger.ok('Menú legacy expandido (#menuNuevo) ya visible.');
    return;
  }

  const facturacionAngular = await locatorFacturacionElectronica(page)
    .first()
    .isVisible()
    .catch(() => false);

  if (facturacionAngular) {
    logger.ok('Menú con textos ya visible.');
    return;
  }

  // ── Perfil Angular (siempre el destino tras login) ──
  if (esPortalAngular(page)) {
    const ok = await abrirMenuEnPerfilAngular(page);
    if (ok) return;

    // Respaldo: pantalla de inicio con el mismo menú
    logger.paso('MENÚ', 'Probando menú desde /inicio/NAT...');
    await page.goto(config.urls.inicioNat, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    if (await abrirMenuEnPerfilAngular(page)) return;

    const hayEnlaces = (await page.locator(SELECTOR.submenuComprobantes).count()) > 0;
    if (hayEnlaces) {
      logger.warn('Menú no visible, pero el enlace de comprobantes existe en DOM.');
      return;
    }

    throw new Error(
      'En /contribuyente/perfil no se encontró el menú ni enlaces. Sube ESPERA_POST_LOGIN_MS.'
    );
  }

  // ── Portal legacy (JSF) ──
  if (await page.locator(SELECTOR.menuColapsado).isVisible().catch(() => false)) {
    await clicIconoFacturacionColapsado(page);
  } else {
    await clicHamburguesaLegacy(page);
  }

  if (!(await esperarMenuListo(page))) {
    throw new Error('No se abrió el menú legacy. Revisa var/capturas/error_flujo.');
  }

  logger.ok('Menú lateral listo.');
}

/**
 * PASO 3: Expande "FACTURACIÓN ELECTRÓNICA" (un solo clic).
 * @param {import('playwright').Page} page
 */
export async function expandirModuloFacturacion(page) {
  logger.separador('PASO 3 — FACTURACIÓN ELECTRÓNICA');

  const legacy = page.locator(SELECTOR.menuFacturacionLegacy);
  const legacyVisible = await legacy.first().isVisible().catch(() => false);
  const angular = locatorFacturacionElectronica(page).first();
  const angularVisible = await angular.isVisible().catch(() => false);

  if (legacyVisible) {
    logger.paso('FACTURACIÓN', 'Clic en #sri-menu-icon-facturacion-electronica...');
    await legacy.first().click();
  } else if (angularVisible) {
    logger.paso('FACTURACIÓN', 'Clic en enlace "FACTURACIÓN ELECTRÓNICA"...');
    await angular.click();
  } else {
    logger.paso('FACTURACIÓN', 'Clic en "FACTURACIÓN ELECTRÓNICA" vía DOM (panel oculto)...');
    const clicado = await clicEnlaceEnDom(page, { textoExacto: 'FACTURACIÓN ELECTRÓNICA' });
    if (!clicado) {
      await clicIconoFacturacionColapsado(page);
      await clicEnlaceEnDom(page, { textoExacto: 'FACTURACIÓN ELECTRÓNICA' });
    }
  }

  const sub = locatorComprobantesRecibidos(page);
  try {
    await sub.waitFor({ state: 'visible', timeout: config.timeout });
  } catch {
    logger.warn('Subítem en DOM pero oculto; se usará clic forzado en el paso 4 si hace falta.');
    await sub.waitFor({ state: 'attached', timeout: 5000 });
  }

  logger.ok('Listo para entrar a Comprobantes recibidos.');
}

/**
 * PASO 4: Entra a "Comprobantes electrónicos recibidos".
 * @param {import('playwright').Page} page
 */
export async function irAComprobantesRecibidos(page) {
  logger.separador('PASO 4 — COMPROBANTES RECIBIDOS');

  const enlace = locatorComprobantesRecibidos(page);
  await enlace.waitFor({ state: 'attached' });

  logger.paso('COMPROBANTES', 'Clic en "Comprobantes electrónicos recibidos"...');

  const navegar = page.waitForURL(/comprobantes-electronicos-internet|tuportal-internet/i, {
    waitUntil: 'networkidle',
    timeout: config.timeout,
  });

  const visible = await enlace.isVisible().catch(() => false);
  if (visible) {
    await Promise.all([navegar, enlace.click()]);
  } else {
    const clicDom = await clicEnlaceEnDom(page, { hrefContiene: 'redireccion=57&idGrupo=55' });
    if (!clicDom) {
      await Promise.all([navegar, enlace.click({ force: true })]);
    } else {
      await navegar;
    }
  }

  await cerrarAvisoNavegadorSiExiste(page);

  // accederAplicacion.jspa redirige al módulo JSF en un segundo paso
  if (!page.url().includes('comprobantesRecibidos')) {
    await page
      .waitForURL(/comprobantesRecibidos/i, { waitUntil: 'networkidle', timeout: config.timeout })
      .catch(() => logger.warn('No se detectó comprobantesRecibidos.jsf; quizá quedó en tuportal.'));
  }

  const urlActual = page.url();
  if (urlActual.includes('/auth/realms/')) {
    throw new Error('El portal redirigió al login al abrir comprobantes recibidos.');
  }

  logger.ok(`Módulo cargado → ${urlActual}`);
  await capturarPantalla(page, 'comprobantes_recibidos');
  logger.ok('Captura guardada en var/capturas/');
}

/**
 * Guarda cookies y storage en JSON para que PHP use cURL con la misma sesión.
 * @param {import('playwright').BrowserContext} context
 */
async function exportarSesionParaPhp(context) {
  await exportarSesionConMeta(context);
}

/**
 * Orquestador principal.
 * @param {import('playwright').Page} page
 * @param {import('playwright').BrowserContext} context
 */
export async function ejecutarFlujoSRI(page, context) {
  try {
    await iniciarSesion(page);
    await esperarPortalCargado(page);
    await abrirMenuLateral(page);
    await expandirModuloFacturacion(page);
    await irAComprobantesRecibidos(page);
    await exportarSesionParaPhp(context);

    logger.separador();
    logger.ok('✅ Flujo completado. Se llegó a "Comprobantes electrónicos recibidos".');
    logger.info(
      'Siguiente paso: php bin/recibidos.php --anio=2026 --mes-desde=9 --mes-hasta=11'
    );
    logger.separador();
  } catch (err) {
    logger.error('El flujo falló en algún paso:', err);
    try {
      await capturarPantalla(page, 'error_flujo');
      logger.warn('Captura de pantalla del error guardada en var/capturas/');
    } catch { /* ignorar */ }
    throw err;
  }
}
