#!/usr/bin/env php
<?php

declare(strict_types=1);

/**
 * Verifica que PHP puede leer la sesión y cargar la pantalla de comprobantes (cURL).
 */

require dirname(__DIR__) . '/php/bootstrap.php';

use Sri\Comprobantes\ComprobantesRecibidosClient;
use Sri\Config;

try {
    $config = new Config();
    $cliente = new ComprobantesRecibidosClient($config);
    $resp = $cliente->cargarPantallaConsulta();

    $raiz = dirname(__DIR__);
    $out = $raiz . '/var/capturas/php_comprobantes_' . date('Ymd_His') . '.html';
    if (!is_dir(dirname($out))) {
        mkdir(dirname($out), 0755, true);
    }
    file_put_contents($out, $resp->body);

    $tieneFormulario = str_contains($resp->body, 'frmPrincipal:btnBuscar') ? 'sí' : 'no';
    echo "[OK] HTTP {$resp->status}. Formulario consulta: {$tieneFormulario}. HTML: {$out}\n";
} catch (Throwable $e) {
    fwrite(STDERR, '[ERROR] ' . $e->getMessage() . PHP_EOL);
    exit(1);
}
