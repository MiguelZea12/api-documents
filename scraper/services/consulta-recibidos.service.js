/**
 * Consulta comprobantes recibidos en el navegador (reCAPTCHA solo resuelve en browser).
 */

import config from '../config/env.js';
import logger from '../utils/logger.js';
import { capturarPantalla } from './navegador.service.js';

const SELECTOR = {
  btnBuscar: '#frmPrincipal\\:btnBuscar',
  tablaDatos: '#frmPrincipal\\:tablaCompRecibidos_data',
  ano: '#frmPrincipal\\:ano',
  mes: '#frmPrincipal\\:mes',
  dia: '#frmPrincipal\\:dia',
  tipo: '#frmPrincipal\\:cmbTipoComprobante',
};

const esperaAjaxMs = () => (config.headless ? 25000 : 90000);

/**
 * @param {import('playwright').Request} request
 */
function esPostConsultaComprobantes(request) {
  if (request.method() !== 'POST') return false;
  if (!request.url().includes('comprobantesRecibidos.jsf')) return false;

  const data = request.postData() ?? '';
  if (!data.includes('javax.faces.partial.ajax')) return false;

  return (
    data.includes('frmPrincipal%3AbtnBuscar') ||
    data.includes('frmPrincipal:btnBuscar') ||
    data.includes('frmPrincipal%3Aj_idt36') ||
    data.includes('j_idt36')
  );
}

/**
 * @param {string} html
 * @returns {string[]}
 */
export function extraerClavesAcceso(html) {
  const bloque =
    html.match(
      /id="frmPrincipal:tablaCompRecibidos_data"[^>]*>([\s\S]*?)<\/tbody>/i
    )?.[1] ?? html;

  const claves = new Set();
  const reValue = /value="(\d{49})"/g;
  const reText = />\s*(\d{49})\s*</g;

  let m;
  while ((m = reValue.exec(bloque)) !== null) claves.add(m[1]);
  while ((m = reText.exec(bloque)) !== null) claves.add(m[1]);

  return [...claves].sort();
}

/**
 * @param {import('playwright').Page} page
 * @returns {Promise<boolean>}
 */
async function hayCaptchaIncorrecta(page) {
  const html = await page.content();
  return /captcha\s+incorrecta/i.test(html);
}

/** Antes de la 1.ª consulta: cargarRecaptcha() del portal necesita un momento. */
export async function esperarRecaptchaInicial(page) {
  await page
    .waitForFunction(
      () =>
        (typeof grecaptcha !== 'undefined' &&
          (grecaptcha.enterprise || grecaptcha.execute)) ||
        document.querySelector('#recaptcha-container') !== null,
      { timeout: 25000 }
    )
    .catch(() => logger.warn('reCAPTCHA no reportó listo; se consulta igualmente.'));
  await page.waitForTimeout(2000);
}

async function cerrarAvisosFormulario(page) {
  await page
    .locator('.ui-messages-close, a.ui-messages-close')
    .first()
    .click()
    .catch(() => {});
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(800);
}

/**
 * @param {import('playwright').Page} page
 */
async function esperarBotonConsultarListo(page) {
  await page
    .waitForFunction(
      () => {
        const b = document.querySelector('#frmPrincipal\\:btnBuscar');
        if (!b) return false;
        if (b.disabled) return false;
        return !b.classList.contains('ui-state-disabled');
      },
      { timeout: 60000 }
    )
    .catch(() => {});
}

/**
 * @param {import('playwright').Page} page
 */
async function aplicarFiltros(page, { anio, mes, dia, tipo }) {
  await esperarBotonConsultarListo(page);

  await page.locator(SELECTOR.ano).selectOption(String(anio));
  await page.locator(SELECTOR.mes).selectOption(String(mes));
  await page.locator(SELECTOR.dia).selectOption(String(dia));
  await page.locator(SELECTOR.tipo).selectOption(tipo);

  await page.waitForTimeout(400);

  const valores = await page.evaluate(() => {
    const val = (id) => document.querySelector(id)?.value ?? '';
    return {
      ano: val('#frmPrincipal\\:ano'),
      mes: val('#frmPrincipal\\:mes'),
      dia: val('#frmPrincipal\\:dia'),
      tipo: val('#frmPrincipal\\:cmbTipoComprobante'),
    };
  });

  return valores;
}

/**
 * @param {import('playwright').Page} page
 * @param {{ anio: number, mes: number, dia: number, tipo: string }} params
 * @param {number} intento
 */
async function consultarUnMesIntento(page, params, intento) {
  const { anio, mes, dia, tipo } = params;
  const etiqueta = `${anio}-${String(mes).padStart(2, '0')}`;

  const filtros = await aplicarFiltros(page, params);
  if (filtros.mes !== String(mes)) {
    logger.warn(`Filtro mes no aplicado (esperado ${mes}, DOM=${filtros.mes})`);
  }

  const respuestaConsulta = page.waitForResponse(
    (r) => esPostConsultaComprobantes(r.request()),
    { timeout: esperaAjaxMs() }
  );

  await page.locator(SELECTOR.btnBuscar).click();

  let cuerpoAjax = '';
  try {
    const response = await respuestaConsulta;
    cuerpoAjax = await response.text();
  } catch {
    await capturarPantalla(page, `sin_ajax_${etiqueta}_i${intento}`);
    logger.warn(
      `Sin POST de consulta (${etiqueta}, intento ${intento}). reCAPTCHA o botón bloqueado.`
    );
    return [];
  }

  if (await hayCaptchaIncorrecta(page)) {
    await capturarPantalla(page, `captcha_incorrecta_${etiqueta}_i${intento}`);
    logger.warn(`Captcha incorrecta (${etiqueta}, intento ${intento}); suele pasar en la 1.ª consulta.`);
    await cerrarAvisosFormulario(page);
    return [];
  }

  let claves = extraerClavesAcceso(cuerpoAjax);

  if (claves.length === 0) {
    await page
      .waitForFunction(
        () => {
          const tb = document.querySelector('#frmPrincipal\\:tablaCompRecibidos_data');
          if (!tb) return false;
          return /\d{49}/.test(tb.innerText) || tb.querySelectorAll('tr').length > 0;
        },
        { timeout: 20000 }
      )
      .catch(() => {});

    await page.waitForTimeout(800);
    claves = extraerClavesAcceso(await page.content());
  }

  return claves;
}

/**
 * @param {import('playwright').Page} page
 * @param {{ anio: number, mes: number, dia: number, tipo: string }} params
 * @returns {Promise<string[]>}
 */
export async function consultarUnMes(page, params) {
  const { anio, mes, dia, tipo } = params;
  logger.paso(
    'CONSULTA',
    `${anio}-${String(mes).padStart(2, '0')} día=${dia} tipo=${tipo}`
  );

  let claves = [];

  for (let intento = 1; intento <= 3 && claves.length === 0; intento += 1) {
    if (intento > 1) {
      logger.warn(`Reintento ${intento}/3 (reCAPTCHA o tabla vacía)...`);
      await page.waitForTimeout(3000);
      await esperarBotonConsultarListo(page);
    }
    claves = await consultarUnMesIntento(page, params, intento);
  }

  logger.ok(`Claves en esta consulta: ${claves.length}`);

  if (claves.length === 0) {
    await capturarPantalla(page, `cero_claves_${anio}_${mes}`);
  }

  return claves;
}

/**
 * @param {number[]} meses
 */
export function listarMeses(anio, mes, mesDesde, mesHasta) {
  if (mes !== null && mes !== undefined) {
    return [mes];
  }
  const desde = mesDesde ?? 1;
  const hasta = mesHasta ?? 12;
  const out = [];
  for (let m = desde; m <= hasta; m += 1) out.push(m);
  return out;
}
