<?php

declare(strict_types=1);

namespace Sri\Comprobantes;

use DOMDocument;
use RuntimeException;

/**
 * Extrae del XML SRI los campos de negocio para reportes (factura v2.x).
 *
 * @phpstan-type ResumenFactura array{
 *   numeroFactura: string,
 *   autorizacion: string,
 *   cliente: string,
 *   identificacionCliente: ?string,
 *   fechaEmision: ?string,
 *   subtotal: float,
 *   subtotal0: float,
 *   subtotal5: float,
 *   subtotal15: float,
 *   iva: float,
 *   descuento: float,
 *   total: float
 * }
 */
final class FacturaXmlResumenParser
{
    public const PERSPECTIVA_RECIBIDOS = 'recibidos';
    public const PERSPECTIVA_EMITIDOS = 'emitidos';

    /**
     * @return ResumenFactura
     */
    public static function desdeArchivo(string $rutaXml, string $perspectiva): array
    {
        if (!is_readable($rutaXml)) {
            throw new RuntimeException('No se puede leer: ' . $rutaXml);
        }

        return self::desdeContenido((string) file_get_contents($rutaXml), $perspectiva);
    }

    /**
     * @return ResumenFactura
     */
    public static function desdeContenido(string $xml, string $perspectiva): array
    {
        $cuerpo = self::extraerBloqueFactura($xml);

        if (class_exists(DOMDocument::class)) {
            return self::desdeDom($cuerpo, $perspectiva);
        }

        return self::desdeRegex($cuerpo, $perspectiva);
    }

    private static function extraerBloqueFactura(string $xml): string
    {
        $cuerpo = $xml;
        if (!preg_match('/<factura[\s>]/i', $cuerpo)) {
            if (preg_match('/<comprobante[^>]*>([\s\S]*?)<\/comprobante>/i', $cuerpo, $m)) {
                $cuerpo = html_entity_decode(trim($m[1]), ENT_QUOTES | ENT_XML1, 'UTF-8');
            }
        }

        if (!preg_match('/<factura[\s>]/i', $cuerpo)) {
            throw new RuntimeException('El XML no contiene un nodo factura.');
        }

        return $cuerpo;
    }

    /**
     * @return ResumenFactura
     */
    private static function desdeDom(string $cuerpo, string $perspectiva): array
    {
        $dom = new DOMDocument();
        if (@$dom->loadXML($cuerpo, LIBXML_NOERROR | LIBXML_NOWARNING) === false) {
            throw new RuntimeException('XML de factura inválido.');
        }

        $estab = self::textoDom($dom, 'estab');
        $ptoEmi = self::textoDom($dom, 'ptoEmi');
        $secuencial = self::textoDom($dom, 'secuencial');
        $clave = self::textoDom($dom, 'claveAcceso') ?? '';

        if ($perspectiva === self::PERSPECTIVA_EMITIDOS) {
            $cliente = self::textoDom($dom, 'razonSocialComprador') ?? '';
            $idCliente = self::textoDom($dom, 'identificacionComprador');
        } else {
            $cliente = self::textoDom($dom, 'razonSocial') ?? '';
            $idCliente = self::textoDom($dom, 'ruc');
        }

        $impuestos = self::impuestosInfoFacturaDom($dom);

        return self::armarResumen(
            $estab,
            $ptoEmi,
            $secuencial,
            $clave,
            $cliente,
            $idCliente,
            self::textoDom($dom, 'fechaEmision'),
            self::textoDom($dom, 'totalSinImpuestos'),
            self::textoDom($dom, 'totalDescuento'),
            self::textoDom($dom, 'importeTotal'),
            $impuestos
        );
    }

    /**
     * @return ResumenFactura
     */
    private static function desdeRegex(string $cuerpo, string $perspectiva): array
    {
        $estab = self::etiqueta($cuerpo, 'estab');
        $ptoEmi = self::etiqueta($cuerpo, 'ptoEmi');
        $secuencial = self::etiqueta($cuerpo, 'secuencial');
        $clave = self::etiqueta($cuerpo, 'claveAcceso') ?? '';

        if ($perspectiva === self::PERSPECTIVA_EMITIDOS) {
            $cliente = self::etiqueta($cuerpo, 'razonSocialComprador') ?? '';
            $idCliente = self::etiqueta($cuerpo, 'identificacionComprador');
        } else {
            $cliente = self::etiqueta($cuerpo, 'razonSocial') ?? '';
            $idCliente = self::etiqueta($cuerpo, 'ruc');
        }

        $impuestos = self::impuestosInfoFacturaRegex($cuerpo);

        return self::armarResumen(
            $estab,
            $ptoEmi,
            $secuencial,
            $clave,
            $cliente,
            $idCliente,
            self::etiqueta($cuerpo, 'fechaEmision'),
            self::etiqueta($cuerpo, 'totalSinImpuestos'),
            self::etiqueta($cuerpo, 'totalDescuento'),
            self::etiqueta($cuerpo, 'importeTotal'),
            $impuestos
        );
    }

    /**
     * @return ResumenFactura
     */
    private static function armarResumen(
        ?string $estab,
        ?string $pto,
        ?string $sec,
        string $clave,
        string $cliente,
        ?string $idCliente,
        ?string $fecha,
        ?string $subtotal,
        ?string $descuento,
        ?string $total,
        array $impuestos
    ): array {
        return [
            'numeroFactura' => self::numeroFactura($estab, $pto, $sec),
            'autorizacion' => $clave,
            'cliente' => $cliente,
            'identificacionCliente' => $idCliente,
            'fechaEmision' => $fecha,
            'subtotal' => self::decimal($subtotal),
            'subtotal0' => $impuestos['subtotal0'],
            'subtotal5' => $impuestos['subtotal5'],
            'subtotal15' => $impuestos['subtotal15'],
            'iva' => $impuestos['iva'],
            'descuento' => self::decimal($descuento),
            'total' => self::decimal($total),
        ];
    }

    private static function etiqueta(string $xml, string $nombre): ?string
    {
        if (!preg_match('/<' . preg_quote($nombre, '/') . '>([^<]*)</', $xml, $m)) {
            return null;
        }

        $v = trim($m[1]);

        return $v === '' ? null : $v;
    }

    private static function textoDom(DOMDocument $dom, string $etiqueta): ?string
    {
        $nodes = $dom->getElementsByTagName($etiqueta);
        if ($nodes->length === 0) {
            return null;
        }

        $v = trim($nodes->item(0)?->textContent ?? '');

        return $v === '' ? null : $v;
    }

    private static function numeroFactura(?string $estab, ?string $pto, ?string $sec): string
    {
        if ($estab === null || $pto === null || $sec === null) {
            return '';
        }

        return sprintf('%s-%s-%s', $estab, $pto, $sec);
    }

    private static function decimal(?string $valor): float
    {
        if ($valor === null || $valor === '') {
            return 0.0;
        }

        return round((float) str_replace(',', '.', $valor), 2);
    }

  /** Solo totalConImpuestos de infoFactura (no líneas de detalle). */
  private static function impuestosInfoFacturaDom(DOMDocument $dom): array
    {
        $acum = TarifaIvaSri::vacio();
        $info = $dom->getElementsByTagName('infoFactura')->item(0);
        if ($info === null) {
            return $acum;
        }

        /** @var \DOMElement $info */
        foreach ($info->getElementsByTagName('totalImpuesto') as $nodo) {
            $linea = self::leerLineaImpuestoDom($nodo);
            if ($linea !== null) {
                TarifaIvaSri::acumularLinea($linea, $acum);
            }
        }

        return $acum;
    }

    private static function impuestosInfoFacturaRegex(string $cuerpo): array
    {
        $acum = TarifaIvaSri::vacio();
        $bloqueInfo = $cuerpo;
        if (preg_match('/<infoFactura>([\s\S]*?)<\/infoFactura>/i', $cuerpo, $m)) {
            $bloqueInfo = $m[1];
        }

        if (!preg_match_all('/<totalImpuesto>([\s\S]*?)<\/totalImpuesto>/i', $bloqueInfo, $bloques)) {
            return $acum;
        }

        foreach ($bloques[1] as $bloque) {
            $linea = self::leerLineaImpuestoRegex($bloque);
            if ($linea !== null) {
                TarifaIvaSri::acumularLinea($linea, $acum);
            }
        }

        return $acum;
    }

    /**
     * @return array{base: float, pct: string, valorIva: float}|null
     */
    private static function leerLineaImpuestoDom(\DOMNode $nodo): ?array
    {
        $codigo = null;
        $pct = null;
        $base = null;
        $valor = null;

        foreach ($nodo->childNodes as $hijo) {
            if ($hijo->nodeType !== XML_ELEMENT_NODE) {
                continue;
            }
            $nombre = $hijo->localName;
            $texto = trim($hijo->textContent);
            if ($nombre === 'codigo') {
                $codigo = $texto;
            } elseif ($nombre === 'codigoPorcentaje') {
                $pct = $texto;
            } elseif ($nombre === 'baseImponible') {
                $base = $texto;
            } elseif ($nombre === 'valor') {
                $valor = $texto;
            }
        }

        if ($codigo !== '2' || $pct === null || $base === null) {
            return null;
        }

        return [
            'base' => self::decimal($base),
            'pct' => $pct,
            'valorIva' => self::decimal($valor),
        ];
    }

    /**
     * @return array{base: float, pct: string, valorIva: float}|null
     */
    private static function leerLineaImpuestoRegex(string $bloque): ?array
    {
        $codigo = self::etiqueta($bloque, 'codigo');
        if ($codigo !== '2') {
            return null;
        }

        $pct = self::etiqueta($bloque, 'codigoPorcentaje');
        $base = self::etiqueta($bloque, 'baseImponible');
        if ($pct === null || $base === null) {
            return null;
        }

        return [
            'base' => self::decimal($base),
            'pct' => $pct,
            'valorIva' => self::decimal(self::etiqueta($bloque, 'valor')),
        ];
    }
}
