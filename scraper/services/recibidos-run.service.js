/**
 * Un solo flujo: sesión (si hace falta) → consultar mes(es) → JSON/CSV.
 */

import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import config from '../config/env.js';
import logger from '../utils/logger.js';
import { etiquetaMes, etiquetaPeriodo } from '../lib/args-recibidos.js';
import { dirDescarga } from '../lib/rutas-descargas.js';
import {
  abrirNavegador,
  abrirNavegadorConSesion,
  cerrarNavegador,
} from './navegador.service.js';
import {
  limpiarSesionGuardada,
  sesionGuardadaEsDelRucActual,
} from '../lib/sesion-storage.js';
import {
  consultarUnMes,
  esperarRecaptchaInicial,
  listarMeses,
} from './consulta-recibidos.service.js';
import { asegurarPantallaConsulta } from './sesion-comprobantes.service.js';

/**
 * @param {string} periodo ej. 2026-10
 * @param {string[]} claves
 * @returns {Promise<{ json: string, csv: string, directorio: string }>}
 */
async function guardarClavesMes(periodo, claves) {
  const dir = dirDescarga('recibidos', periodo);
  await fsPromises.mkdir(dir, { recursive: true });

  const ordenadas = [...claves].sort();
  const archivoJson = path.join(dir, 'claves-acceso.json');
  const archivoCsv = path.join(dir, 'claves-acceso.csv');

  await fsPromises.writeFile(archivoJson, JSON.stringify(ordenadas, null, 2));
  await fsPromises.writeFile(archivoCsv, `clave_acceso\n${ordenadas.join('\n')}`);

  return { json: archivoJson, csv: archivoCsv, directorio: dir };
}

/** @param {ReturnType<import('../lib/args-recibidos.js').parseArgsRecibidos>} args */
export async function ejecutarRecibidos(args) {
  const meses = listarMeses(args.anio, args.mes, args.mesDesde, args.mesHasta);

  logger.separador('COMPROBANTES RECIBIDOS — consulta única');
  logger.info(
    `Periodo: ${etiquetaPeriodo(args.anio, args.mes, args.mesDesde, args.mesHasta)} | ` +
      `día=${args.dia} (0=Todos) | tipo=${args.tipo} | meses: ${meses.join(',')}`
  );

  const tieneSesion = sesionGuardadaEsDelRucActual();

  let browser = null;
  const clavesUnicas = new Set();
  /** @type {Record<string, { claves: string[], archivos: Awaited<ReturnType<typeof guardarClavesMes>> }>} */
  const porMes = {};

  try {
    const sesion = tieneSesion
      ? await abrirNavegadorConSesion()
      : await abrirNavegador();
    browser = sesion.browser;
    const { page, context } = sesion;

    await asegurarPantallaConsulta(page, context);
    await esperarRecaptchaInicial(page);

    const consultarMes = async (mes) =>
      consultarUnMes(page, {
        anio: args.anio,
        mes,
        dia: args.dia,
        tipo: args.tipo,
      });

    for (const mes of meses) {
      let claves = await consultarMes(mes);
      claves.forEach((c) => clavesUnicas.add(c));

      const carpetaMes = etiquetaMes(args.anio, mes);
      let archivos = await guardarClavesMes(carpetaMes, claves);
      porMes[carpetaMes] = { claves, archivos };

      console.log(
        `[OK] ${carpetaMes}: ${claves.length} clave(s) → ${archivos.json}`
      );

      await page.waitForTimeout(600);
    }

    const mesesSinDatos = meses.filter((m) => (porMes[etiquetaMes(args.anio, m)]?.claves.length ?? 0) === 0);
    if (mesesSinDatos.length > 0 && meses.length > 1) {
      logger.warn(`Repaso de meses con 0 claves: ${mesesSinDatos.join(',')}`);
      for (const mes of mesesSinDatos) {
        const claves = await consultarMes(mes);
        if (claves.length === 0) continue;

        claves.forEach((c) => clavesUnicas.add(c));
        const carpetaMes = etiquetaMes(args.anio, mes);
        const archivos = await guardarClavesMes(carpetaMes, claves);
        porMes[carpetaMes] = { claves, archivos };
        console.log(`[OK] repaso ${carpetaMes}: ${claves.length} clave(s) → ${archivos.json}`);
      }
    }

    const lista = [...clavesUnicas].sort();

    console.log(`\n[RESUMEN] Meses consultados: ${meses.length} | Total únicas en el rango: ${lista.length}`);

    if (meses.length > 1) {
      const etiquetaRango = etiquetaPeriodo(
        args.anio,
        args.mes,
        args.mesDesde,
        args.mesHasta
      );
      const dirRango = dirDescarga('recibidos', etiquetaRango);
      await fsPromises.mkdir(dirRango, { recursive: true });
      const indice = {
        periodo: etiquetaRango,
        anio: args.anio,
        meses,
        totalUnicas: lista.length,
        porMes: Object.fromEntries(
          Object.entries(porMes).map(([k, v]) => [k, { total: v.claves.length, json: v.archivos.json }])
        ),
      };
      const indicePath = path.join(dirRango, 'indice.json');
      await fsPromises.writeFile(indicePath, JSON.stringify(indice, null, 2));
      console.log(`[INFO] Índice del rango (sin mezclar claves): ${indicePath}`);
    }

    if (lista.length === 0) {
      console.log(
        '[AVISO] Sin claves en el periodo. Si debería haber datos, revisa HEADLESS=false en .env.'
      );
    }

    return { claves: lista, porMes, totalUnicas: lista.length };
  } finally {
    await cerrarNavegador(browser);
    if (config.cerrarSesionAlSalir) {
      limpiarSesionGuardada();
    }
  }
}
