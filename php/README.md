# PHP — cliente cURL del SRI

Biblioteca para **sesión**, **formulario JSF** y parseo de resultados. La **consulta con datos** va por `bin/recibidos.php` (incluye scraper por reCAPTCHA).

## Uso típico

```bash
# Desde la raíz del repo
php bin/recibidos.php --anio=2026 --mes-desde=9 --mes-hasta=11
php bin/probar-sesion.php
```

## Variables (.env en la raíz)

| Variable | Default |
|----------|---------|
| `SRI_SESSION_FILE` | `var/sessions/sri-storage-state.json` |
| `DESCARGAS_DIR` | `var/descargas` |
| `SRI_RUC` | Carpeta `var/descargas/{RUC}/recibidos|emitidos/...` |

Salidas: `var/descargas/{RUC}/recibidos/YYYY-MM/` y `.../emitidos/YYYY-MM/`.

## Paquetes PHP (`php/src/`)

| Carpeta | Rol |
|---------|-----|
| `Http/` | cURL, cookie jar, respuestas |
| `Session/` | Lee `storageState` de Playwright |
| `Comprobantes/` | Filtros, cliente JSF, parser de claves |

**reCAPTCHA:** la lista de claves requiere `php bin/recibidos.php`.

**XML autorizado (fase 2):** `php bin/descargar-xml.php` → SOAP `AutorizacionComprobantesOffline`, solo la clave de 49 dígitos, sin cookies del login.
