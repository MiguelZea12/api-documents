#!/usr/bin/env php
<?php

declare(strict_types=1);

/**
 * Proceso único:
 *   1) Consulta comprobantes recibidos (claves) — scraper + reCAPTCHA
 *   2) Descarga XML autorizado por cada clave — SOAP cel.sri.gob.ec (sin sesión)
 *   3) comprobantes.json (número, cliente/proveedor, subtotal, IVA, total, …)
 *
 *   php bin/recibidos.php --anio=2026 --mes=10
 *   php bin/recibidos.php --anio=2026 --mes-desde=9 --mes-hasta=11
 *   php bin/recibidos.php ... --sin-xml   (solo claves, sin fase 2)
 */

require dirname(__DIR__) . '/php/bootstrap.php';

use Sri\Autorizacion\DescargaXmlService;
use Sri\Comprobantes\ComprobantesResumenService;
use Sri\Comprobantes\FacturaXmlResumenParser;
use Sri\Comprobantes\PeriodoConsulta;
use Sri\Config;

$opciones = getopt('', [
    'anio:',
    'mes::',
    'mes-desde::',
    'mes-hasta::',
    'dia::',
    'tipo::',
    'sin-xml',
]);

$anio = isset($opciones['anio']) ? (int) $opciones['anio'] : (int) date('Y');
$mes = isset($opciones['mes']) ? (int) $opciones['mes'] : null;
$mesDesde = isset($opciones['mes-desde']) ? (int) $opciones['mes-desde'] : null;
$mesHasta = isset($opciones['mes-hasta']) ? (int) $opciones['mes-hasta'] : null;
$dia = isset($opciones['dia']) ? (int) $opciones['dia'] : 0;
$tipo = $opciones['tipo'] ?? '1';
$sinXml = isset($opciones['sin-xml']);

try {
    $periodo = new PeriodoConsulta($anio, $mes, $mesDesde, $mesHasta);
} catch (Throwable $e) {
    fwrite(STDERR, '[ERROR] ' . $e->getMessage() . PHP_EOL);
    exit(1);
}

$raiz = dirname(__DIR__);
$cmd = [
    'node',
    $raiz . '/scraper/cli/recibidos.js',
    '--anio=' . $anio,
    '--dia=' . $dia,
    '--tipo=' . $tipo,
];

if ($mes !== null) {
    $cmd[] = '--mes=' . $mes;
}
if ($mesDesde !== null) {
    $cmd[] = '--mes-desde=' . $mesDesde;
}
if ($mesHasta !== null) {
    $cmd[] = '--mes-hasta=' . $mesHasta;
}

$linea = implode(' ', array_map('escapeshellarg', $cmd));
echo "[INFO] Fase 1 — consulta claves: {$linea}\n";

passthru($linea, $code);
if ($code !== 0) {
    exit(1);
}

if ($sinXml) {
    echo "[INFO] Fase 2 omitida (--sin-xml).\n";
    exit(0);
}

$config = new Config();
$rutas = $config->rutasDescarga();
$descargaXml = new DescargaXmlService($config);

echo "\n[FASE 2] Descarga XML autorizado (SOAP, sin sesión del portal)\n";
echo '[INFO] Contribuyente: ' . $rutas->segmentoRuc() . "\n";

$totalOk = 0;
$totalFallos = 0;

foreach ($periodo->meses() as $m) {
    $carpeta = sprintf('%04d-%02d', $anio, $m);
    $dir = $rutas->dir('recibidos', $carpeta);
    $json = $dir . '/claves-acceso.json';

    if (!is_readable($json)) {
        echo "[WARN] Sin claves para {$carpeta}; se omite descarga XML.\n";
        continue;
    }

    echo "\n--- Periodo {$carpeta} ---\n";
    $res = $descargaXml->descargarClaves(
        $descargaXml->clavesDesdeJson($json),
        $dir
    );
    $totalOk += $res['ok'];
    $totalFallos += $res['fallos'];
}

echo "\n[FASE 3] comprobantes.json desde XML\n";
$resumenSvc = new ComprobantesResumenService();
$perspectiva = FacturaXmlResumenParser::PERSPECTIVA_RECIBIDOS;

foreach ($periodo->meses() as $m) {
    $carpeta = sprintf('%04d-%02d', $anio, $m);
    $dir = $rutas->dir('recibidos', $carpeta);

    if (!is_dir($dir . '/xml')) {
        echo "[WARN] Sin XML en {$carpeta}; se omite resumen.\n";
        continue;
    }

    try {
        $resumen = $resumenSvc->exportarDirectorio($dir, $perspectiva);
        echo "[OK] {$carpeta}: {$resumen['total']} fila(s) → {$resumen['archivo']}\n";
        foreach ($resumen['errores'] as $err) {
            echo "[WARN]   {$err}\n";
        }
    } catch (Throwable $e) {
        echo "[WARN] {$carpeta}: " . $e->getMessage() . "\n";
    }
}

echo "\n[FIN] Proceso completo. XML autorizados: {$totalOk} | fallos: {$totalFallos}\n";
exit($totalFallos > 0 && $totalOk === 0 ? 1 : 0);
