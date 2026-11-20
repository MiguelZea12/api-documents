#!/usr/bin/env php
<?php

declare(strict_types=1);

/**
 * Solo fase 2 (re-descarga XML si ya tienes claves-acceso.json).
 * El flujo normal es: php bin/recibidos.php (incluye fase 1 + 2).
 *
 *   php bin/descargar-xml.php --clave=49digitos...
 *   php bin/descargar-xml.php --periodo=2026-10
 *   php bin/descargar-xml.php --periodo=2026-07 --tipo=emitidos
 *   php bin/descargar-xml.php --json=var/descargas/{ruc}/recibidos/2026-10/claves-acceso.json
 *
 * WS: AutorizacionComprobantesOffline (cel.sri.gob.ec)
 */

require dirname(__DIR__) . '/php/bootstrap.php';

use Sri\Autorizacion\DescargaXmlService;
use Sri\Config;

$opciones = getopt('', ['clave:', 'json:', 'periodo:', 'tipo::']);

try {
    $config = new Config();
    $rutas = $config->rutasDescarga();
    $servicio = new DescargaXmlService($config);
    $tipo = $opciones['tipo'] ?? 'recibidos';
    if ($tipo !== 'recibidos' && $tipo !== 'emitidos') {
        throw new RuntimeException('--tipo debe ser recibidos o emitidos');
    }

    $claves = [];
    $salida = $config->descargasDir;

    if (isset($opciones['clave'])) {
        $claves = [(string) $opciones['clave']];
        $salida = $rutas->dir('recibidos', '_puntual/' . $opciones['clave']);
    } elseif (isset($opciones['json'])) {
        $json = $opciones['json'];
        if (!str_starts_with($json, '/')) {
            $json = dirname(__DIR__) . '/' . ltrim($json, '/');
        }
        $claves = $servicio->clavesDesdeJson($json);
        $salida = dirname($json);
    } elseif (isset($opciones['periodo'])) {
        $salida = $rutas->dir($tipo, (string) $opciones['periodo']);
        $claves = $servicio->clavesDesdeJson($salida . '/claves-acceso.json');
    } else {
        fwrite(STDERR, "Indica --clave, --json o --periodo (ej. --periodo=2026-10)\n");
        exit(1);
    }

    if ($claves === []) {
        throw new RuntimeException('No hay claves para descargar.');
    }

    $servicio->descargarClaves($claves, $salida);
} catch (Throwable $e) {
    fwrite(STDERR, '[ERROR] ' . $e->getMessage() . PHP_EOL);
    exit(1);
}
