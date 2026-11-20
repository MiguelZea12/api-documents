<?php

declare(strict_types=1);

namespace Sri\Comprobantes;

use RuntimeException;

/**
 * Genera comprobantes.json a partir de los XML en {directorio}/xml/.
 */
final class ComprobantesResumenService
{
    /**
     * @param 'recibidos'|'emitidos' $perspectiva
     * @return array{total: int, archivo: string, errores: list<string>}
     */
    public function exportarDirectorio(string $directorio, string $perspectiva): array
    {
        if ($perspectiva !== FacturaXmlResumenParser::PERSPECTIVA_RECIBIDOS
            && $perspectiva !== FacturaXmlResumenParser::PERSPECTIVA_EMITIDOS) {
            throw new RuntimeException('perspectiva debe ser recibidos o emitidos');
        }

        $xmlDir = rtrim($directorio, '/') . '/xml';
        if (!is_dir($xmlDir)) {
            throw new RuntimeException("No existe carpeta XML: {$xmlDir}");
        }

        $items = [];
        $errores = [];

        foreach (glob($xmlDir . '/*.xml') ?: [] as $archivo) {
            if (str_ends_with($archivo, '.soap.xml')) {
                continue;
            }

            try {
                $items[] = FacturaXmlResumenParser::desdeArchivo($archivo, $perspectiva);
            } catch (\Throwable $e) {
                $errores[] = basename($archivo) . ': ' . $e->getMessage();
            }
        }

        usort($items, static fn (array $a, array $b): int => strcmp($a['autorizacion'], $b['autorizacion']));

        $salida = rtrim($directorio, '/') . '/comprobantes.json';
        $json = json_encode($items, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        if ($json === false) {
            throw new RuntimeException('No se pudo serializar comprobantes.json');
        }

        if (file_put_contents($salida, $json) === false) {
            throw new RuntimeException('No se pudo escribir ' . $salida);
        }

        return [
            'total' => count($items),
            'archivo' => $salida,
            'errores' => $errores,
        ];
    }
}
