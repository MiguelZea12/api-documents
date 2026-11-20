#!/usr/bin/env php
<?php

declare(strict_types=1);

/**
 * @deprecated Usa bin/recibidos.php (mismo servicio, un solo flujo).
 *
 * Solo cURL (sin tabla por reCAPTCHA) o delegación al scraper con --navegador.
 */

require dirname(__DIR__) . '/php/bootstrap.php';

use Sri\Comprobantes\DescargaMasivaService;
use Sri\Comprobantes\FiltroConsultaRecibidos;
use Sri\Comprobantes\PeriodoConsulta;
use Sri\Comprobantes\TiposComprobante;
use Sri\Config;

$opciones = getopt('', ['anio:', 'mes::', 'mes-desde::', 'mes-hasta::', 'dia::', 'tipo::', 'navegador']);
$anio = isset($opciones['anio']) ? (int) $opciones['anio'] : (int) date('Y');
$mes = isset($opciones['mes']) ? (int) $opciones['mes'] : null;
$mesDesde = isset($opciones['mes-desde']) ? (int) $opciones['mes-desde'] : null;
$mesHasta = isset($opciones['mes-hasta']) ? (int) $opciones['mes-hasta'] : null;
$dia = isset($opciones['dia']) ? (int) $opciones['dia'] : 0;
$tipo = $opciones['tipo'] ?? TiposComprobante::FACTURA;

try {
    if (isset($opciones['navegador'])) {
        $raiz = dirname(__DIR__);
        $cmd = ['php', $raiz . '/bin/recibidos.php', '--anio=' . $anio, '--dia=' . $dia, '--tipo=' . $tipo];
        if ($mes !== null) {
            $cmd[] = '--mes=' . $mes;
        }
        if ($mesDesde !== null) {
            $cmd[] = '--mes-desde=' . $mesDesde;
        }
        if ($mesHasta !== null) {
            $cmd[] = '--mes-hasta=' . $mesHasta;
        }
        passthru(implode(' ', array_map('escapeshellarg', $cmd)), $code);
        exit($code !== 0 ? 1 : 0);
    }

    fwrite(STDERR, "[AVISO] Sin --navegador el SRI no devuelve datos (reCAPTCHA). Usa: php bin/recibidos.php\n");

    $config = new Config();
    $periodo = new PeriodoConsulta($anio, $mes, $mesDesde, $mesHasta);
    $tipos = [(string) $tipo];

    if (!in_array((string) $tipo, TiposComprobante::todos(), true)) {
        throw new InvalidArgumentException('Tipo de comprobante inválido. Use: 1,2,3,4,6');
    }

    echo "[INFO] Periodo: {$periodo->etiqueta()} | día={$dia} (0=Todos) | tipo="
        . TiposComprobante::etiqueta((string) $tipo) . " ({$tipo}) | meses: "
        . implode(',', $periodo->meses()) . PHP_EOL;

    $filtro = new FiltroConsultaRecibidos($periodo, $dia, $tipos);
    $servicio = new DescargaMasivaService($config);
    $servicio->ejecutar($filtro);
} catch (Throwable $e) {
    fwrite(STDERR, '[ERROR] ' . $e->getMessage() . PHP_EOL);
    exit(1);
}
