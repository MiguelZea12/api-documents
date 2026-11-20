#!/usr/bin/env php
<?php

declare(strict_types=1);

/**
 * Proceso único:
 *   1) Consulta comprobantes emitidos (claves) — scraper Playwright día a día
 *   2) Descarga XML autorizado por cada clave — SOAP cel.sri.gob.ec (sin sesión)
 *   3) comprobantes.json (si hay XML en xml/)
 *
 *   php bin/emitidos.php --anio=2026 --mes=7              (solo Factura por defecto)
 *   php bin/emitidos.php --anio=2026 --mes=11 --tipos=1,6
 *   php bin/emitidos.php --anio=2026 --mes=10 --sin-xml   (solo claves)
 *
 * Tipos: 1=Factura  2=Liquidación  3=Nota de Crédito  4=Nota de Débito
 *        5=Guía de Remisión  6=Retención
 */

require dirname(__DIR__) . '/php/bootstrap.php';

use Sri\Autorizacion\DescargaXmlService;
use Sri\Comprobantes\ComprobantesResumenService;
use Sri\Comprobantes\FacturaXmlResumenParser;
use Sri\Config;

$opciones = getopt('', [
    'anio:',
    'mes:',
    'tipos::',
    'estado::',
    'sin-xml',
]);

$anio    = isset($opciones['anio'])   ? (int) $opciones['anio']  : (int) date('Y');
$mes     = isset($opciones['mes'])    ? (int) $opciones['mes']   : (int) date('n');
$tipos   = $opciones['tipos']  ?? '1';
$estado  = $opciones['estado'] ?? 'AUT';
$sinXml  = isset($opciones['sin-xml']);

if ($mes < 1 || $mes > 12) {
    fwrite(STDERR, "[ERROR] --mes debe estar entre 1 y 12.\n");
    exit(1);
}

$carpeta  = sprintf('%04d-%02d', $anio, $mes);
$raiz     = dirname(__DIR__);

// ─── FASE 1: consulta claves vía scraper Node ────────────────────────────────

$cmd = [
    'node',
    $raiz . '/scraper/cli/emitidos.js',
    '--anio=' . $anio,
    '--mes='  . $mes,
    '--tipos=' . $tipos,
    '--estado=' . $estado,
];

$linea = implode(' ', array_map('escapeshellarg', $cmd));
echo "[INFO] Fase 1 — consulta claves: {$linea}\n";

passthru($linea, $code);
if ($code !== 0) {
    exit(1);
}

// ─── FASE 2: descarga XML vía SOAP (mismo servicio que recibidos) ────────────

if ($sinXml) {
    echo "[INFO] Fase 2 omitida (--sin-xml).\n";
    exit(0);
}

$config = new Config();
$rutas = $config->rutasDescarga();
$descargaXml = new DescargaXmlService($config);

$dir = $rutas->dir('emitidos', $carpeta);
$json = $dir . '/claves-acceso.json';

if (!is_readable($json)) {
    echo "[WARN] Sin claves para emitidos {$carpeta} (RUC {$rutas->segmentoRuc()}); se omite descarga XML.\n";
    exit(0);
}

echo "\n[FASE 2] Descarga XML autorizado (SOAP, sin sesión del portal)\n";
echo "--- Periodo {$carpeta} (emitidos) ---\n";

$res = $descargaXml->descargarClaves(
    $descargaXml->clavesDesdeJson($json),
    $dir
);

if (is_dir($dir . '/xml')) {
    echo "\n[FASE 3] comprobantes.json desde XML\n";
    try {
        $resumenSvc = new ComprobantesResumenService();
        $resumen = $resumenSvc->exportarDirectorio($dir, FacturaXmlResumenParser::PERSPECTIVA_EMITIDOS);
        echo "[OK] {$resumen['total']} fila(s) → {$resumen['archivo']}\n";
        foreach ($resumen['errores'] as $err) {
            echo "[WARN] {$err}\n";
        }
    } catch (Throwable $e) {
        echo '[WARN] Resumen omitido: ' . $e->getMessage() . "\n";
    }
}

echo "\n[FIN] Proceso completo. XML autorizados: {$res['ok']} | fallos: {$res['fallos']}\n";
exit($res['fallos'] > 0 && $res['ok'] === 0 ? 1 : 0);
