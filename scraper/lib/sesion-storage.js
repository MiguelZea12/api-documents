/**
 * Sesión Playwright por contribuyente (RUC) y limpieza al terminar el proceso.
 */

import fs from 'fs';
import path from 'path';
import config from '../config/env.js';
import logger from '../utils/logger.js';

export function segmentoRuc() {
  return String(config.ruc ?? '').replace(/\D/g, '') || 'sin-ruc';
}

/** Ruta efectiva: por RUC salvo que .env fije SRI_SESSION_FILE. */
export function rutaSesionEfectiva() {
  if (process.env.SRI_SESSION_FILE?.trim()) {
    return process.env.SRI_SESSION_FILE.trim();
  }
  return `var/sessions/${segmentoRuc()}/sri-storage-state.json`;
}

export function rutaMetaSesion() {
  const base = path.resolve(rutaSesionEfectiva());
  return base.replace(/\.json$/i, '.meta.json');
}

export function sesionGuardadaExiste() {
  return fs.existsSync(path.resolve(rutaSesionEfectiva()));
}

/**
 * true si el archivo de sesión corresponde al SRI_RUC actual (.meta.json).
 */
export function sesionGuardadaEsDelRucActual() {
  const ruta = path.resolve(rutaSesionEfectiva());
  if (!fs.existsSync(ruta)) {
    return false;
  }

  const metaPath = rutaMetaSesion();
  if (!fs.existsSync(metaPath)) {
    return false;
  }

  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    const guardado = String(meta.ruc ?? '').replace(/\D/g, '');
    return guardado !== '' && guardado === segmentoRuc();
  } catch {
    return false;
  }
}

/**
 * @param {import('playwright').BrowserContext} context
 */
export async function exportarSesionConMeta(context) {
  if (!config.exportarSesion) {
    return;
  }

  const ruta = path.resolve(rutaSesionEfectiva());
  await fs.promises.mkdir(path.dirname(ruta), { recursive: true });
  await context.storageState({ path: ruta });

  const meta = {
    ruc: segmentoRuc(),
    guardadoEn: new Date().toISOString(),
  };
  await fs.promises.writeFile(rutaMetaSesion(), JSON.stringify(meta, null, 2));

  logger.ok(`Sesión exportada (${meta.ruc}) → ${ruta}`);
}

/**
 * Borra la sesión del RUC actual (y meta). Llamar al cerrar el navegador.
 */
export function limpiarSesionGuardada() {
  const ruta = path.resolve(rutaSesionEfectiva());
  const meta = rutaMetaSesion();

  const legacyGlobal = path.resolve('var/sessions/sri-storage-state.json');
  const legacyMeta = legacyGlobal.replace(/\.json$/i, '.meta.json');

  for (const f of [ruta, meta, legacyGlobal, legacyMeta]) {
    if (fs.existsSync(f)) {
      try {
        fs.unlinkSync(f);
      } catch {
        logger.warn(`No se pudo borrar sesión: ${f}`);
      }
    }
  }

  logger.info('Sesión del portal cerrada (archivos eliminados para el próximo RUC).');
}

/**
 * Comprueba en /contribuyente/perfil que el portal muestra el RUC del .env.
 * @param {import('playwright').Page} page
 */
export async function sesionEsDelRucActual(page) {
  const ruc = segmentoRuc();
  if (ruc === 'sin-ruc') {
    return false;
  }

  await page.goto(config.urls.perfilContribuyente, {
    waitUntil: 'domcontentloaded',
    timeout: config.timeout,
  });

  if (page.url().includes('/auth/realms/')) {
    return false;
  }

  const cuerpo = await page.textContent('body').catch(() => '');
  return cuerpo.includes(ruc);
}
