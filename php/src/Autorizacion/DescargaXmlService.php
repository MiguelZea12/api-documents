<?php

declare(strict_types=1);

namespace Sri\Autorizacion;

use Sri\Config;

/**
 * Fase 2: por cada clave, SOAP autorización → XML en disco (sin sesión web).
 */
final class DescargaXmlService
{
    private AutorizacionComprobanteClient $cliente;

    public function __construct(private readonly Config $config, ?AutorizacionComprobanteClient $cliente = null)
    {
        $this->cliente = $cliente ?? new AutorizacionComprobanteClient();
    }

    /**
     * @param list<string> $claves
     * @return array{ok: int, fallos: int, detalle: list<array<string, mixed>>}
     */
    public function descargarClaves(array $claves, string $directorioSalida): array
    {
        $ok = 0;
        $fallos = 0;
        $detalle = [];

        $xmlDir = rtrim($directorioSalida, '/') . '/xml';
        if (!is_dir($xmlDir)) {
            mkdir($xmlDir, 0755, true);
        }

        foreach ($claves as $clave) {
            echo "[INFO] SOAP autorización: {$clave}\n";

            try {
                $soap = $this->cliente->consultar($clave);
                $datos = AutorizacionSoapParser::parsear($soap);

                $item = [
                    'clave' => $clave,
                    'estado' => $datos['estado'],
                    'archivo' => null,
                    'mensajes' => $datos['mensajes'],
                ];

                if ($datos['xmlComprobante'] !== null && $datos['estado'] === 'AUTORIZADO') {
                    $archivo = $xmlDir . '/' . $clave . '.xml';
                    AutorizacionSoapParser::guardarXmlComprobante($archivo, $datos['xmlComprobante']);
                    $item['archivo'] = $archivo;
                    $ok++;
                    echo "[OK] XML guardado: {$archivo}\n";
                } else {
                    $fallos++;
                    $msg = $datos['mensajes'] !== [] ? implode('; ', $datos['mensajes']) : $datos['estado'];
                    echo "[WARN] Sin XML ({$clave}): {$msg}\n";
                    $soapDebug = $xmlDir . '/' . $clave . '.soap.xml';
                    file_put_contents($soapDebug, $soap);
                    $item['soap_debug'] = $soapDebug;
                }

                $detalle[] = $item;
            } catch (\Throwable $e) {
                $fallos++;
                echo '[ERROR] ' . $clave . ': ' . $e->getMessage() . PHP_EOL;
                $detalle[] = ['clave' => $clave, 'error' => $e->getMessage()];
            }

            usleep(200_000);
        }

        $manifiesto = $directorioSalida . '/descarga-xml.json';
        file_put_contents(
            $manifiesto,
            json_encode(['ok' => $ok, 'fallos' => $fallos, 'detalle' => $detalle], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
        );

        echo "\n[RESUMEN] XML autorizados: {$ok} | fallos: {$fallos}\n";
        echo "Manifiesto: {$manifiesto}\n";

        return ['ok' => $ok, 'fallos' => $fallos, 'detalle' => $detalle];
    }

    /**
     * @return list<string>
     */
    public function clavesDesdeJson(string $rutaJson): array
    {
        if (!is_readable($rutaJson)) {
            throw new \RuntimeException("No existe JSON de claves: {$rutaJson}");
        }

        $data = json_decode(file_get_contents($rutaJson), true);
        if (!is_array($data)) {
            throw new \RuntimeException('JSON de claves inválido.');
        }

        return array_values(array_filter($data, static fn ($c) => is_string($c) && preg_match('/^\d{49}$/', $c)));
    }
}
