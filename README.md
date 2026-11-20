# SRI — comprobantes electrónicos recibidos

Consulta masiva de **claves de acceso** (facturas recibidas) en el portal del SRI Ecuador.

## Estructura del proyecto

```
api-documents/
├── bin/                 # Comandos (lo que ejecutas)
│   ├── recibidos.php    # ★ Servicio principal (consulta mes o rango)
│   ├── probar-sesion.php
│   └── descarga-masiva.php  # legado (solo cURL; sin reCAPTCHA no hay datos)
├── scraper/             # Node + Playwright (login, reCAPTCHA, consulta)
│   ├── cli/
│   ├── config/
│   ├── services/
│   ├── lib/
│   └── utils/
├── php/                 # Librería PHP (cURL, parsers, sesión Playwright)
│   ├── bootstrap.php
│   └── src/
└── var/                 # Datos generados (no versionar)
    ├── sessions/        # sri-storage-state.json
    ├── descargas/       # por RUC → recibidos|emitidos → YYYY-MM
    └── capturas/        # HTML y PNG de depuración
```

## Configuración

```bash
cp .env.example .env   # SRI_RUC, SRI_CLAVE
npm install
npx playwright install chromium
```

## Uso (un solo comando — consulta + XML)

```bash
php bin/recibidos.php --anio=2026 --mes=10
php bin/recibidos.php --anio=2026 --mes-desde=9 --mes-hasta=11
php bin/emitidos.php --anio=2026 --mes=7
```

Eso hace **todo** en secuencia:

1. **Claves** (navegador / reCAPTCHA) → `var/descargas/{RUC}/recibidos/YYYY-MM/claves-acceso.json`
2. **XML autorizado** (SOAP) → `var/descargas/{RUC}/recibidos/YYYY-MM/xml/<clave>.xml`
3. **Resumen JSON** → `var/descargas/{RUC}/recibidos/YYYY-MM/comprobantes.json` (número, proveedor, subtotal, IVA, total, …)

**Emitidos:** `var/descargas/{RUC}/emitidos/YYYY-MM/` (misma idea: un carpeta por contribuyente del `.env`).

Varios clientes: cambia `SRI_RUC` / `SRI_CLAVE` en `.env` (o un `.env` por cliente). Sesión en `var/sessions/{RUC}/` y al terminar `recibidos.php`/`emitidos.php` se **borra** la sesión (no reutilizar el usuario anterior). No uses `SRI_SESSION_FILE` compartido entre RUCs.

Solo claves, sin XML: añade `--sin-xml`.

En servidor sin monitor: `./bin/recibidos-servidor.sh` (mismo proceso completo).

El script renueva la sesión (login + menú) si expiró; no hace falta `npm start` antes.

## Producción (sin ventana en pantalla, pero con reCAPTCHA)

Google **bloquea** muchas consultas con `HEADLESS=true`. En el servidor:

```bash
chmod +x bin/recibidos-servidor.sh
./bin/recibidos-servidor.sh --anio=2026 --mes=11
```

Usa **Xvfb** (pantalla virtual) + `HEADLESS=false`: no abre ventana en tu PC, pero el navegador no va en modo headless.

## Comandos opcionales

| Comando | Para qué |
|--------|----------|
| `npm run login` | Solo probar login y exportar sesión |
| `php bin/probar-sesion.php` | Verificar que PHP/cURL ve el formulario |

Re-descargar XML si ya tienes claves: `php bin/descargar-xml.php --periodo=2026-10` (recibidos). Emitidos: añade `--tipo=emitidos`.

Solo regenerar JSON desde XML ya descargados: `php bin/comprobantes-resumen.php --periodo=2026-10`.

Detalle del módulo PHP: [php/README.md](php/README.md).
