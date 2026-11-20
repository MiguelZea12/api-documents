/**
 * env.js
 * Carga y valida las variables de entorno desde el archivo .env.
 * Lanza un error descriptivo si falta alguna variable obligatoria,
 * evitando fallos silenciosos en tiempo de ejecución.
 */

import 'dotenv/config';

// Variables obligatorias que DEBEN existir en el .env
const REQUERIDAS = ['SRI_RUC', 'SRI_CLAVE'];

/**
 * Valida que todas las variables requeridas estén presentes.
 * @throws {Error} Si falta alguna variable
 */
function validarEnv() {
  const faltantes = REQUERIDAS.filter((clave) => !process.env[clave]);
  if (faltantes.length > 0) {
    throw new Error(
      `Faltan variables de entorno obligatorias: ${faltantes.join(', ')}\n` +
      'Asegúrate de tener un archivo .env con esas claves (ver .env.example).'
    );
  }
}

validarEnv();

/** @type {object} Configuración centralizada del proyecto */
const config = {
  // Credenciales SRI
  ruc:      process.env.SRI_RUC,
  clave:    process.env.SRI_CLAVE,

  // Headless solo con SRI_ALLOW_HEADLESS=true (reCAPTCHA suele fallar si no).
  headless:
    process.env.HEADLESS === 'true' && process.env.SRI_ALLOW_HEADLESS === 'true',
  timeout:  parseInt(process.env.TIMEOUT_MS ?? '30000', 10),

  // Tiempo extra tras el login para que Angular termine (OAuth + menú)
  esperaPostLoginMs: parseInt(process.env.ESPERA_POST_LOGIN_MS ?? '25000', 10),

  // URLs del portal SRI
  urls: {
    // Página de login (portal nuevo Angular)
    login:
      'https://srienlinea.sri.gob.ec/auth/realms/Internet/protocol/openid-connect/auth' +
      '?client_id=app-sri-claves-angular' +
      '&redirect_uri=https%3A%2F%2Fsrienlinea.sri.gob.ec%2Fsri-en-linea%2F%2Fcontribuyente%2Fperfil' +
      '&state=ea35fe03-57fa-4cc5-8b98-ce8c13e0cda6' +
      '&nonce=ea0e773d-7687-4b93-9832-ca654092af61' +
      '&response_mode=fragment' +
      '&response_type=code' +
      '&scope=openid',

    // Tras el login OAuth el redirect fija esta ruta (con #state=... en el hash)
    perfilContribuyente:
      'https://srienlinea.sri.gob.ec/sri-en-linea/contribuyente/perfil',

    // Inicio NAT: a veces el menú lateral responde mejor que en /perfil
    inicioNat: 'https://srienlinea.sri.gob.ec/sri-en-linea/inicio/NAT',

    comprobantesRecibidos:
      'https://srienlinea.sri.gob.ec/comprobantes-electronicos-internet/pages/consultas/recibidos/comprobantesRecibidos.jsf',
  },

  // Ruta donde se guardan capturas de pantalla (para depuración)
  rutaCapturas: './var/capturas',

  // Sesión Playwright: una carpeta por RUC (ver scraper/lib/sesion-storage.js).
  // Si defines SRI_SESSION_FILE, úsalo solo para un contribuyente fijo.
  rutaSesion:
    process.env.SRI_SESSION_FILE?.trim()
    || `var/sessions/${(process.env.SRI_RUC || '').replace(/\D/g, '') || 'sin-ruc'}/sri-storage-state.json`,
  exportarSesion: process.env.EXPORTAR_SESION !== 'false',
  /** Al terminar recibidos/emitidos, borrar sesión (evita mezclar usuarios). */
  cerrarSesionAlSalir: process.env.SRI_CERRAR_SESION_AL_SALIR !== 'false',
};

export default config;
