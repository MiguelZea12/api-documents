/**
 * emitidos-run.service.js
 *
 * Orquestación completa:
 *   abrir navegador → sesión → navegar a "Comprobantes emitidos"
 *   → consultar día a día → guardar JSON/CSV → cerrar
 */

import fsPromises   from 'fs/promises';
import path         from 'path';

import config       from '../config/env.js';
import logger       from '../utils/logger.js';
import { etiquetaMes } from '../lib/args-emitidos.js';
import { dirDescarga } from '../lib/rutas-descargas.js';
import {
  abrirNavegadorConSesion,
  abrirNavegador,
  cerrarNavegador,
} from './navegador.service.js';
import {
  limpiarSesionGuardada,
  sesionEsDelRucActual,
  sesionGuardadaEsDelRucActual,
} from '../lib/sesion-storage.js';
import {
  iniciarSesion,
  esperarPortalCargado,
  abrirMenuLateral,
} from './sri.service.js';
import { irAModuloEmitidos } from './emitidos-nav.service.js';
import { consultarMes }      from './consulta-emitidos.service.js';

// ─── Persistencia ─────────────────────────────────────────────────────────────

/**
 * Guarda las claves de acceso en JSON y CSV dentro de
 * var/descargas/{RUC}/emitidos/{YYYY-MM}/
 *
 * @param {string} subdirMes  p. ej. "2026-11"
 * @param {string[]} claves
 * @returns {Promise<{ json: string, csv: string, directorio: string }>}
 */
async function guardarClavesEmitidos(periodo, claves) {
  const dir = dirDescarga('emitidos', periodo);
  await fsPromises.mkdir(dir, { recursive: true });

  const ordenadas  = [...claves].sort();
  const archivoJson = path.join(dir, 'claves-acceso.json');
  const archivoCsv  = path.join(dir, 'claves-acceso.csv');

  await fsPromises.writeFile(archivoJson, JSON.stringify(ordenadas, null, 2));
  await fsPromises.writeFile(archivoCsv,  `clave_acceso\n${ordenadas.join('\n')}`);

  return { json: archivoJson, csv: archivoCsv, directorio: dir };
}

// ─── Sesión / portal ──────────────────────────────────────────────────────────

/**
 * Garantiza que la página esté en el portal del contribuyente.
 * Si la sesión expiró, hace login completo.
 */
async function asegurarPortalActivo(page, context) {
  const esRucDelEnv = await sesionEsDelRucActual(page);

  if (page.url().includes('/auth/realms/') || !esRucDelEnv) {
    if (!page.url().includes('/auth/realms/')) {
      logger.warn(`Sesión de otro contribuyente (esperado ${config.ruc}); login de nuevo...`);
      limpiarSesionGuardada();
      await context.clearCookies();
    } else {
      logger.info('Sesión expirada; iniciando login...');
    }
    await iniciarSesion(page);
    await esperarPortalCargado(page);
  } else {
    logger.ok('Sesión vigente para el RUC del .env.');
    await page.waitForTimeout(2_000);
  }

  await abrirMenuLateral(page);
}

// ─── Función principal exportada ──────────────────────────────────────────────

/**
 * @param {{ anio: number, mes: number, tipos: string[], estado: string }} args
 * @returns {Promise<{ claves: string[], json: string, csv: string }>}
 */
export async function ejecutarEmitidos(args) {
  const { anio, mes, tipos, estado } = args;
  const mesLabel = etiquetaMes(anio, mes);

  logger.separador('COMPROBANTES EMITIDOS — inicio');
  logger.info(
    `Mes: ${mesLabel} | tipos: ${tipos.join(',')} | estado: ${estado}`
  );

  const tieneSesion = sesionGuardadaEsDelRucActual();

  let browser = null;

  try {
    // 1. Abrir navegador (con sesión guardada si existe)
    const sesion = tieneSesion
      ? await abrirNavegadorConSesion()
      : await abrirNavegador();
    browser = sesion.browser;
    const { page, context } = sesion;

    // 2. Garantizar portal activo
    await asegurarPortalActivo(page, context);

    // 3. Navegar a "Comprobantes electrónicos emitidos"
    await irAModuloEmitidos(page, context);

    // 4. Consultar día a día
    const claves = await consultarMes(page, { anio, mes, tipos, estado });

    // 5. Guardar resultados
    const archivos = await guardarClavesEmitidos(mesLabel, claves);

    logger.ok(`\n✅ ${mesLabel}: ${claves.length} clave(s) → ${archivos.json}`);
    logger.info(`   CSV: ${archivos.csv}`);

    return { claves, json: archivos.json, csv: archivos.csv };
  } finally {
    await cerrarNavegador(browser);
    if (config.cerrarSesionAlSalir) {
      limpiarSesionGuardada();
    }
  }
}
