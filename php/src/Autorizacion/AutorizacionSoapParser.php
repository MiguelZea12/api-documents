<?php

declare(strict_types=1);

namespace Sri\Autorizacion;

use RuntimeException;

/**
 * Extrae estado y XML del comprobante desde la respuesta SOAP del SRI.
 */
final class AutorizacionSoapParser
{
    /**
     * @return array{
     *   estado: string,
     *   numeroAutorizacion: ?string,
     *   fechaAutorizacion: ?string,
     *   ambiente: ?string,
     *   xmlComprobante: ?string,
     *   mensajes: list<string>
     * }
     */
    public static function parsear(string $soapXml): array
    {
        if (!str_contains($soapXml, 'RespuestaAutorizacionComprobante')) {
            return [
                'estado' => 'RESPUESTA_INVALIDA',
                'numeroAutorizacion' => null,
                'fechaAutorizacion' => null,
                'ambiente' => null,
                'xmlComprobante' => null,
                'mensajes' => ['La respuesta del SRI no es un XML SOAP de autorización.'],
            ];
        }

        $estado = self::primerValor($soapXml, 'estado');
        $numero = self::primerValor($soapXml, 'numeroAutorizacion');
        $fecha = self::primerValor($soapXml, 'fechaAutorizacion');
        $ambiente = self::primerValor($soapXml, 'ambiente');
        $numeroComprobantes = self::primerValor($soapXml, 'numeroComprobantes');

        $mensajes = [];
        if (preg_match_all('/<mensaje>([^<]*)<\/mensaje>/', $soapXml, $mm)) {
            $mensajes = $mm[1];
        }

        if ($estado === null && $numeroComprobantes === '0') {
            $estado = 'NO_ENCONTRADO';
            $mensajes[] =
                'El servicio de autorización no registró comprobantes para esta clave (numeroComprobantes=0). '
                . 'La consulta de emitidos en el portal puede listarla, pero el WS público no devuelve XML autorizado.';
        } elseif ($estado === null) {
            $estado = 'DESCONOCIDO';
        }

        $xmlComprobante = null;
        if (preg_match('/<comprobante>([\s\S]*?)<\/comprobante>/', $soapXml, $m)) {
            $interno = html_entity_decode(trim($m[1]), ENT_QUOTES | ENT_XML1, 'UTF-8');
            if ($interno !== '' && str_contains($interno, '<')) {
                $xmlComprobante = $interno;
            }
        }

        return [
            'estado' => $estado,
            'numeroAutorizacion' => $numero,
            'fechaAutorizacion' => $fecha,
            'ambiente' => $ambiente,
            'xmlComprobante' => $xmlComprobante,
            'mensajes' => $mensajes,
        ];
    }

    private static function primerValor(string $xml, string $etiqueta): ?string
    {
        if (preg_match('/<' . preg_quote($etiqueta, '/') . '>([^<]*)</', $xml, $m)) {
            $v = trim($m[1]);
            return $v === '' ? null : $v;
        }

        return null;
    }

    public static function guardarXmlComprobante(string $ruta, string $xmlComprobante): void
    {
        $dir = dirname($ruta);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        if (!str_starts_with($xmlComprobante, '<?xml')) {
            $xmlComprobante = '<?xml version="1.0" encoding="UTF-8"?>' . "\n" . $xmlComprobante;
        }

        if (file_put_contents($ruta, $xmlComprobante) === false) {
            throw new RuntimeException('No se pudo escribir ' . $ruta);
        }
    }
}
