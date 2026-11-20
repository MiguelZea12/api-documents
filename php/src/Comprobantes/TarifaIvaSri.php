<?php

declare(strict_types=1);

namespace Sri\Comprobantes;

/**
 * codigoPorcentaje del IVA (codigo impuesto 2) en facturas SRI → subtotales por tarifa.
 */
final class TarifaIvaSri
{
    /** @return array{subtotal0: float, subtotal5: float, subtotal15: float, iva: float} */
    public static function vacio(): array
    {
        return [
            'subtotal0' => 0.0,
            'subtotal5' => 0.0,
            'subtotal15' => 0.0,
            'iva' => 0.0,
        ];
    }

    /**
     * @param array{base: float, pct: string, valorIva: float} $linea
     * @param array{subtotal0: float, subtotal5: float, subtotal15: float, iva: float} $acum
     */
    public static function acumularLinea(array $linea, array &$acum): void
    {
        $acum['iva'] = round($acum['iva'] + $linea['valorIva'], 2);

        switch ($linea['pct']) {
            case '0':
            case '6':
            case '7':
                $acum['subtotal0'] = round($acum['subtotal0'] + $linea['base'], 2);
                break;
            case '5':
                $acum['subtotal5'] = round($acum['subtotal5'] + $linea['base'], 2);
                break;
            case '4':
            case '3':
            case '2':
                $acum['subtotal15'] = round($acum['subtotal15'] + $linea['base'], 2);
                break;
            default:
                $acum['subtotal15'] = round($acum['subtotal15'] + $linea['base'], 2);
                break;
        }
    }
}
