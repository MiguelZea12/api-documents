<?php

declare(strict_types=1);

namespace Sri\Comprobantes;

/**
 * Extrae datos de frmPrincipal:tablaCompRecibidos (columna Clave de acceso / Nro. Autorización).
 */
final class TablaComprobantesParser
{
    /**
     * @return list<string> Claves de acceso (49 dígitos)
     */
    public static function clavesAcceso(string $html): array
    {
        $bloque = $html;
        if (preg_match(
            '/id="frmPrincipal:tablaCompRecibidos_data"[^>]*>(.*?)<\/tbody>/is',
            $html,
            $m
        )) {
            $bloque = $m[1];
        }

        $claves = [];

        // Enlaces/celdas con la clave como texto o en value=
        if (preg_match_all('/value="(\d{49})"/', $bloque, $m)) {
            $claves = array_merge($claves, $m[1]);
        }
        if (preg_match_all('/>\s*(\d{49})\s*</', $bloque, $m)) {
            $claves = array_merge($claves, $m[1]);
        }

        $claves = array_values(array_unique($claves));
        sort($claves);

        return $claves;
    }

    public static function tieneTablaResultados(string $html): bool
    {
        return str_contains($html, 'frmPrincipal:tablaCompRecibidos')
            && str_contains($html, 'tablaCompRecibidos_data');
    }
}
