/**
 * Ciclo de vida del navegador Playwright (login, consulta, capturas).
 */

import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import config from '../config/env.js';
import logger from '../utils/logger.js';
import { rutaSesionEfectiva } from '../lib/sesion-storage.js';

/** @returns {import('playwright').LaunchOptions} */
function opcionesLaunch() {
  if (process.env.HEADLESS === 'true' && process.env.SRI_ALLOW_HEADLESS !== 'true') {
    logger.warn(
      'HEADLESS=true ignorado para consultas (reCAPTCHA). Navegador con interfaz. ' +
        'En servidor sin monitor: ./bin/recibidos-servidor.sh'
    );
  }

  /** @type {import('playwright').LaunchOptions} */
  const opts = {
    headless: config.headless,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
    ],
    ignoreDefaultArgs: ['--enable-automation'],
  };

  const channel = process.env.CHROME_CHANNEL?.trim();
  if (channel) {
    opts.channel = channel;
  }

  return opts;
}

/**
 * @param {import('playwright').Browser} browser
 * @param {import('playwright').BrowserContextOptions} [extra]
 */
async function nuevoContexto(browser, extra = {}) {
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'es-EC',
    timezoneId: 'America/Guayaquil',
    ...extra,
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
  });

  context.setDefaultTimeout(config.timeout);
  return context;
}

export async function abrirNavegador() {
  logger.info('Iniciando navegador Chromium...');

  const browser = await chromium.launch(opcionesLaunch());
  const context = await nuevoContexto(browser);
  const page = await context.newPage();

  logger.ok('Navegador listo.');
  return { browser, context, page };
}

export async function abrirNavegadorConSesion() {
  const rutaSesion = path.resolve(rutaSesionEfectiva());
  if (!fs.existsSync(rutaSesion)) {
    throw new Error(`No hay sesión en ${rutaSesion}. Ejecuta login o deja que recibidos.php renueve sesión.`);
  }

  logger.info('Iniciando navegador con sesión guardada...');

  const browser = await chromium.launch(opcionesLaunch());
  const context = await nuevoContexto(browser, { storageState: rutaSesion });
  const page = await context.newPage();

  logger.ok('Navegador listo (sesión cargada).');
  return { browser, context, page };
}

/** @param {import('playwright').Browser | null} browser */
export async function cerrarNavegador(browser) {
  if (browser) {
    await browser.close();
    logger.info('Navegador cerrado.');
  }
}

export async function capturarPantalla(page, nombre, opciones = {}) {
  const ruta = `${config.rutaCapturas}/${nombre}_${Date.now()}.png`;
  await fs.promises.mkdir(path.dirname(path.resolve(ruta)), { recursive: true }).catch(() => {});
  await page.screenshot({ path: ruta, fullPage: true, ...opciones });
  logger.info(`Captura guardada en: ${ruta}`);
  return ruta;
}
