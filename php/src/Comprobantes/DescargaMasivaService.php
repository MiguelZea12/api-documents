<?php

declare(strict_types=1);

namespace Sri\Comprobantes;

use Sri\Config;

/**
 * Descarga masiva: consulta por periodo y extrae claves de acceso de la tabla.
 */
final class DescargaMasivaService
{
    private ComprobantesRecibidosClient $cliente;

    public function __construct(private readonly Config $config)
    {
        $this->cliente = new ComprobantesRecibidosClient($config);
    }

    /**
     * @return array{periodo: string, claves: int, archivo: string, directorio: string}
     */
    public function ejecutar(FiltroConsultaRecibidos $filtro): array
    {
        $this->cliente->cargarPantallaConsulta();
        $claves = $this->cliente->consultarFiltro($filtro);

        $subdir = $filtro->periodo->etiqueta();
        $dir = $this->config->rutasDescarga()->dir('recibidos', str_replace('..', '_', $subdir));

        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        $archivoJson = $dir . '/claves-acceso.json';
        $archivoCsv = $dir . '/claves-acceso.csv';

        file_put_contents($archivoJson, json_encode($claves, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

        $csv = "clave_acceso\n" . implode("\n", $claves);
        file_put_contents($archivoCsv, $csv);

        echo "\n[RESUMEN] Total claves únicas: " . count($claves) . PHP_EOL;
        echo "JSON: {$archivoJson}\n";
        echo "CSV:  {$archivoCsv}\n";

        return [
            'periodo' => $filtro->periodo->etiqueta(),
            'claves' => count($claves),
            'archivo' => $archivoJson,
            'directorio' => $dir,
        ];
    }
}
