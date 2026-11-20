/**
 * logger.js
 * Utilidad para mostrar mensajes en consola con colores y marcas de tiempo.
 * Usa chalk para hacer el output legible y organizado.
 */

import chalk from 'chalk';

// Formatea la hora actual como HH:MM:SS
const hora = () => {
  const ahora = new Date();
  return chalk.gray(
    `[${ahora.toTimeString().slice(0, 8)}]`
  );
};

const logger = {
  /**
   * Mensaje informativo (azul)
   * @param {string} mensaje
   */
  info: (mensaje) => {
    console.log(`${hora()} ${chalk.blueBright('ℹ INFO')}  ${mensaje}`);
  },

  /**
   * Acción exitosa (verde)
   * @param {string} mensaje
   */
  ok: (mensaje) => {
    console.log(`${hora()} ${chalk.greenBright('✔ OK')}    ${mensaje}`);
  },

  /**
   * Advertencia (amarillo)
   * @param {string} mensaje
   */
  warn: (mensaje) => {
    console.log(`${hora()} ${chalk.yellowBright('⚠ WARN')}  ${mensaje}`);
  },

  /**
   * Error (rojo)
   * @param {string} mensaje
   * @param {Error} [err] - Objeto de error opcional para mostrar el stack
   */
  error: (mensaje, err) => {
    console.error(`${hora()} ${chalk.redBright('✖ ERROR')} ${mensaje}`);
    if (err) console.error(chalk.red(err.stack || err.message));
  },

  /**
   * Paso de flujo (magenta) — útil para indicar en qué etapa va el scraper
   * @param {string} paso  - Nombre corto del paso (ej: "LOGIN")
   * @param {string} detalle
   */
  paso: (paso, detalle) => {
    console.log(
      `${hora()} ${chalk.magentaBright('→ PASO')}  ${chalk.bold(paso.padEnd(20))} ${detalle}`
    );
  },

  /**
   * Separador visual para secciones
   * @param {string} [titulo]
   */
  separador: (titulo = '') => {
    const linea = '─'.repeat(55);
    console.log(chalk.dim(titulo ? `\n┌─ ${titulo} ${linea.slice(titulo.length + 3)}\n` : `\n${linea}\n`));
  },
};

export default logger;
