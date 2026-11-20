#!/usr/bin/env php
<?php

declare(strict_types=1);

/**
 * Solo fase 3: genera comprobantes.json desde xml/*.xml
 *
 *   php bin/comprobantes-resumen.php --periodo=2026-10
 *   php bin/comprobantes-resumen.php --periodo=2026-07 --tipo=emitidos
 *   php bin/comprobantes-resumen.php --dir=var/descargas/.../recibidos/2026-10
 */

require dirname(__DIR__) . '/php/bootstrap.php';

use Sri\Comprobantes\ComprobantesResumenService;
use Sri\Config;

$opciones = getopt('', ['periodo:', 'tipo::', 'dir:']);

try {
    $config = new Config();
    $rutas = $config->rutasDescarga();
    $tipo = $opciones['tipo'] ?? 'recibidos';

    if (isset($opciones['dir'])) {
        $dir = $opciones['dir'];
        if (!str_starts_with($dir, '/')) {
            $dir = dirname(__DIR__) . '/' . ltrim($dir, '/');
        }
    } elseif (isset($opciones['periodo'])) {
        if ($tipo !== 'recibidos' && $tipo !== 'emitidos') {
            throw new RuntimeException('--tipo debe ser recibidos o emitidos');
        }
        $dir = $rutas->dir($tipo, (string) $opciones['periodo']);
    } else {
        fwrite(STDERR, "Indica --periodo=2026-10 o --dir=ruta/al/periodo\n");
        exit(1);
    }

    $perspectiva = ($tipo === 'emitidos') ? 'emitidos' : 'recibidos';
    $servicio = new ComprobantesResumenService();
    $res = $servicio->exportarDirectorio($dir, $perspectiva);

    echo "[OK] {$res['total']} comprobante(s) → {$res['archivo']}\n";
    foreach ($res['errores'] as $err) {
        echo "[WARN] {$err}\n";
    }
} catch (Throwable $e) {
    fwrite(STDERR, '[ERROR] ' . $e->getMessage() . PHP_EOL);
    exit(1);
}
