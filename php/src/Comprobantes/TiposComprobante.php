<?php

declare(strict_types=1);

namespace Sri\Comprobantes;

/**
 * Valores del select frmPrincipal:cmbTipoComprobante (portal SRI).
 */
final class TiposComprobante
{
    public const FACTURA = '1';
    public const LIQUIDACION_COMPRA = '2';
    public const NOTA_CREDITO = '3';
    public const NOTA_DEBITO = '4';
    public const COMPROBANTE_RETENCION = '6';

    /** @return list<string> Todos los tipos para descarga masiva */
    public static function todos(): array
    {
        return [
            self::FACTURA,
            self::LIQUIDACION_COMPRA,
            self::NOTA_CREDITO,
            self::NOTA_DEBITO,
            self::COMPROBANTE_RETENCION,
        ];
    }

    public static function etiqueta(string $valor): string
    {
        return match ($valor) {
            self::FACTURA => 'Factura',
            self::LIQUIDACION_COMPRA => 'Liquidación compra',
            self::NOTA_CREDITO => 'Nota crédito',
            self::NOTA_DEBITO => 'Nota débito',
            self::COMPROBANTE_RETENCION => 'Comprobante retención',
            default => 'Tipo ' . $valor,
        };
    }
}
