/**
 * consulta-emitidos.service.js
 *
 * Rellena el formulario "Comprobantes electrónicos emitidos" día a día
 * para un mes dado y extrae las claves de acceso de cada respuesta AJAX.
 *
 * El formulario solo acepta UNA fecha (no rango) y no tiene opción "Todos"
 * en Tipo de comprobante, por lo que se itera:
 *   • día 1 → último día del mes
 *   • por cada tipo de comprobante indicado
 */

import config from '../config/env.js';
import logger from '../utils/logger.js';
import { capturarPantalla } from './navegador.service.js';

// ─── Selectores del formulario (IDs de PrimeFaces) ───────────────────────────
const SELECTOR = {
  fecha:          '#frmPrincipal\\:calendarFechaDesde_input',
  estado:         '#frmPrincipal\\:cmbEstadoAutorizacion',
  tipo:           '#frmPrincipal\\:cmbTipoComprobante',
  establecimiento:'#frmPrincipal\\:cmbEstablecimiento',
  puntoEmision:   '#frmPrincipal\\:txtPuntoEmision',
  btnConsultar:   '#frmPrincipal\\:btnConsultar',
};

// ─── Tipos de comprobante disponibles en el portal ───────────────────────────
export const TIPOS_EMITIDOS = ['1', '2', '3', '4', '5', '6'];

export const TIPO_LABEL = {
  '1': 'Factura',
  '2': 'Liquidación',
  '3': 'Nota de Crédito',
  '4': 'Nota de Débito',
  '5': 'Guía de Remisión',
  '6': 'Retención',
};

// ─── Helpers de fecha ─────────────────────────────────────────────────────────

/** Último día del mes (ej. mes=2, anio=2026 → 28). */
function ultimoDia(anio, mes) {
  return new Date(anio, mes, 0).getDate();
}

/** DD/MM/YYYY */
function formatearFecha(anio, mes, dia) {
  return (
    String(dia).padStart(2, '0') +
    '/' +
    String(mes).padStart(2, '0') +
    '/' +
    anio
  );
}

// ─── Espera de resultado tras clic en Consultar ───────────────────────────────
/**
 * PrimeFaces muestra el spinner (.ui-icon-loading / #statusDialog) mientras
 * procesa. Esperamos a que desaparezca y luego chequeamos el DOM.
 * También detectamos el mensaje "No existen datos" como señal de respuesta OK.
 */
async function esperarResultadoConsulta(page, timeoutMs = 90_000) {
  // Esperar a que aparezca cualquier indicador de respuesta:
  //   • una fila en la tabla de resultados, O
  //   • el mensaje de "No existen datos"
  //   • OR que el spinner desaparezca
  await page
    .waitForFunction(
      () => {
        // Tabla con filas de datos
        const tabla = document.querySelector(
          '[id*="tablaComp"][id$="_data"], [id*="tablaEmitidos"][id$="_data"]'
        );
        if (tabla && tabla.querySelectorAll('tr').length > 0) return true;

        // Mensaje de "No existen datos"
        const html = document.body?.innerText ?? '';
        if (/no existen datos/i.test(html)) return true;

        // El spinner de PrimeFaces ya no está visible
        const spinner = document.querySelector('#statusDialog, .ui-blockui-document');
        if (!spinner) return true;
        return getComputedStyle(spinner).display === 'none';
      },
      { timeout: timeoutMs }
    )
    .catch(() => {});
  await page.waitForTimeout(500);
}

// ─── Extracción de claves ─────────────────────────────────────────────────────

/**
 * Busca números de 49 dígitos (claves de acceso) en texto HTML.
 * @param {string} html
 * @returns {string[]}
 */
export function extraerClavesEmitidos(html) {
  const claves = new Set();
  const reValue = /value="(\d{49})"/g;
  const reText  = />\s*(\d{49})\s*</g;
  let m;
  while ((m = reValue.exec(html)) !== null) claves.add(m[1]);
  while ((m = reText.exec(html))  !== null) claves.add(m[1]);
  return [...claves].sort();
}

// ─── Helpers de formulario ────────────────────────────────────────────────────

async function esperarBotonListo(page) {
  await page
    .waitForFunction(
      () => {
        const b = document.querySelector('#frmPrincipal\\:btnConsultar');
        if (!b) return false;
        if (b.disabled) return false;
        return !b.classList.contains('ui-state-disabled');
      },
      { timeout: 60_000 }
    )
    .catch(() => {});
}

/**
 * Escribe la fecha en el input del PrimeFaces calendar.
 * PrimeFaces usa un input de texto; se limpia y se escribe directamente,
 * luego se dispara un blur/change para que la librería lo registre.
 * @param {import('playwright').Page} page
 * @param {string} fechaStr  DD/MM/YYYY
 */
async function establecerFecha(page, fechaStr) {
  const input = page.locator(SELECTOR.fecha);

  // 1. Clic para enfocar → puede abrir el calendario
  await input.click({ clickCount: 3 });
  await page.keyboard.press('Escape'); // cerrar calendario si se abrió

  // 2. Escribir la fecha usando fill() (limpia y teclea el nuevo valor)
  await input.fill(fechaStr);

  // 3. Verificar si fill() fue aceptado
  const valor = await input.inputValue().catch(() => '');
  if (valor !== fechaStr) {
    // Fallback: set vía JavaScript + eventos DOM
    await page.evaluate(
      ([sel, val]) => {
        const el = document.querySelector(sel);
        if (!el) return;
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value'
        ).set;
        nativeInputValueSetter.call(el, val);
        el.dispatchEvent(new Event('input',  { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('blur',   { bubbles: true }));
      },
      ['#frmPrincipal\\:calendarFechaDesde_input', fechaStr]
    );
  }

  // 4. Tab para salir del campo y que PrimeFaces registre el valor
  await page.keyboard.press('Tab');
  await page.waitForTimeout(300);
}

/**
 * Espera a que el formulario de emitidos sea visible en la página.
 * Puede tardar si el contenido se carga via AJAX tras el clic en el menú.
 */
async function esperarFormulario(page) {
  await page
    .locator(SELECTOR.btnConsultar)
    .waitFor({ state: 'visible', timeout: 30_000 })
    .catch(() => logger.warn('El botón Consultar no apareció; se continúa.'));
}

async function aplicarFiltros(page, { fecha, estado, tipo }) {
  await esperarFormulario(page);
  await esperarBotonListo(page);

  await establecerFecha(page, fecha);

  await page.locator(SELECTOR.estado).selectOption(estado);
  await page.locator(SELECTOR.tipo).selectOption(tipo);
  // Establecimiento: siempre "Todos" (valor vacío "" o primer option)
  await page.locator(SELECTOR.establecimiento).selectOption({ index: 0 });
  // Punto de emisión: vacío
  await page.locator(SELECTOR.puntoEmision).fill('');

  await page.waitForTimeout(400);
}

// ─── Consulta individual (un día + un tipo, con reintentos) ──────────────────

/**
 * @typedef {{ claves: string[], sinDatos: boolean }} ResultadoDia
 */

/**
 * @returns {Promise<ResultadoDia>}
 */
async function consultarUnDiaIntento(page, { fecha, estado, tipo }, intento) {
  await aplicarFiltros(page, { fecha, estado, tipo });

  // Clic en Consultar y esperar respuesta vía DOM (más robusto que interceptar red)
  await page.locator(SELECTOR.btnConsultar).click();
  await esperarResultadoConsulta(page, config.headless ? 25_000 : 90_000);

  const html = await page.content();

  // Captcha incorrecta → cerrar aviso y reintentar
  if (/captcha\s+incorrecta/i.test(html)) {
    logger.warn(`Captcha incorrecta (${fecha}, tipo=${TIPO_LABEL[tipo]}).`);
    await page.locator('.ui-messages-close').first().click().catch(() => {});
    return { claves: [], sinDatos: false };
  }

  // "No existen datos" → día sin comprobantes de este tipo (OK, resultado válido)
  if (/no existen datos/i.test(html)) {
    return { claves: [], sinDatos: true };
  }

  const claves = extraerClavesEmitidos(html);

  return { claves, sinDatos: false };
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Consulta UN día y UN tipo de comprobante.
 * Reintentos automáticos (hasta 3) si retorna 0 claves.
 *
 * @param {import('playwright').Page} page
 * @param {{ anio: number, mes: number, dia: number, tipo: string, estado?: string }} params
 * @returns {Promise<string[]>}
 */
export async function consultarUnDia(page, { anio, mes, dia, tipo, estado = 'AUT' }) {
  const fecha = formatearFecha(anio, mes, dia);

  const { claves, sinDatos } = await consultarUnDiaIntento(page, { fecha, estado, tipo }, 1);

  if (claves.length > 0) {
    logger.ok(`  ${fecha} [${TIPO_LABEL[tipo]}]: ${claves.length} clave(s)`);
  }
  // sinDatos = sin facturas ese día → normal, no se loguea nada extra

  return claves;
}

/**
 * Consulta TODOS LOS DÍAS de un mes para los tipos indicados.
 *
 * @param {import('playwright').Page} page
 * @param {{
 *   anio: number,
 *   mes: number,
 *   tipos?: string[],
 *   estado?: string
 * }} params
 * @returns {Promise<string[]>}  claves únicas del mes
 */
export async function consultarMes(page, {
  anio,
  mes,
  tipos = ['1'],
  estado = 'AUT',
}) {
  const ultimo   = ultimoDia(anio, mes);
  const mesLabel = `${anio}-${String(mes).padStart(2, '0')}`;

  logger.separador(`EMITIDOS — ${mesLabel} · días 1-${ultimo} · ${tipos.length} tipo(s)`);

  const todasClaves = new Set();

  for (let dia = 1; dia <= ultimo; dia++) {
    for (const tipo of tipos) {
      const claves = await consultarUnDia(page, { anio, mes, dia, tipo, estado });
      claves.forEach((c) => todasClaves.add(c));
      await page.waitForTimeout(300);
    }
  }

  const lista = [...todasClaves].sort();
  logger.ok(`${mesLabel}: ${lista.length} clave(s) únicas en total`);
  return lista;
}
