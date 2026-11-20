<?php

declare(strict_types=1);

namespace Sri\Autorizacion;

use RuntimeException;

/**
 * WS SOAP AutorizacionComprobantesOffline (sin sesión, solo clave de 49 dígitos).
 */
final class AutorizacionComprobanteClient
{
    private string $endpoint;

    public function __construct(?string $endpoint = null)
    {
        $this->endpoint = $endpoint
            ?: (getenv('SRI_WS_AUTORIZACION_URL')
                ?: 'https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline');
    }

    public function consultar(string $claveAcceso): string
    {
        if (!preg_match('/^\d{49}$/', $claveAcceso)) {
            throw new RuntimeException('Clave de acceso inválida (se esperan 49 dígitos).');
        }

        $cuerpo = '<?xml version="1.0" encoding="UTF-8"?>'
            . '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" '
            . 'xmlns:ec="http://ec.gob.sri.ws.autorizacion">'
            . '<soapenv:Header/><soapenv:Body>'
            . '<ec:autorizacionComprobante>'
            . '<claveAccesoComprobante>' . $claveAcceso . '</claveAccesoComprobante>'
            . '</ec:autorizacionComprobante>'
            . '</soapenv:Body></soapenv:Envelope>';

        $intentos = 3;
        $ultimoError = '';

        for ($i = 1; $i <= $intentos; $i++) {
            $ch = \curl_init($this->endpoint);
            \curl_setopt_array($ch, [
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => $cuerpo,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 60,
                CURLOPT_FOLLOWLOCATION => false,
                CURLOPT_HTTPHEADER => [
                    'Content-Type: text/xml; charset=utf-8',
                    'SOAPAction: ""',
                    'User-Agent: Mozilla/5.0 (compatible; SRI-soap-client/1.0)',
                ],
            ]);

            $respuesta = \curl_exec($ch);
            $http = (int) \curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $err = \curl_error($ch);
            \curl_close($ch);

            if ($respuesta === false) {
                $ultimoError = 'cURL: ' . $err;
            } elseif ($http >= 400) {
                $ultimoError = "HTTP {$http}";
            } elseif (!self::esRespuestaSoapValida((string) $respuesta)) {
                $ultimoError = $http === 302
                    ? 'Redirección del servidor (302); respuesta no es SOAP'
                    : 'Respuesta no es SOAP (posible HTML de red)';
            } else {
                return (string) $respuesta;
            }

            if ($i < $intentos) {
                usleep(400_000);
            }
        }

        throw new RuntimeException('SOAP autorización: ' . $ultimoError);
    }

    private static function esRespuestaSoapValida(string $cuerpo): bool
    {
        if ($cuerpo === '') {
            return false;
        }

        return str_contains($cuerpo, 'RespuestaAutorizacionComprobante')
            || str_contains($cuerpo, 'autorizacionComprobanteResponse');
    }
}
