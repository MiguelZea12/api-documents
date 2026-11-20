<?php

declare(strict_types=1);

namespace Sri\Comprobantes;

/**
 * Utilidades para formularios JSF del SRI (ViewState, campos ocultos).
 */
final class JsfFormHelper
{
  /**
   * Extrae javax.faces.ViewState del HTML.
   */
    public static function viewState(string $html): ?string
    {
        if (preg_match('/name="javax\.faces\.ViewState"[^>]*value="([^"]+)"/', $html, $m)) {
            return html_entity_decode($m[1], ENT_QUOTES);
        }

        return null;
    }

    /**
     * Devuelve el id del primer formulario principal (suele ser frmPrincipal o similar).
     */
    public static function formId(string $html): ?string
    {
        if (preg_match('/<form[^>]+id="([^"]+)"[^>]*method="post"/i', $html, $m)) {
            return $m[1];
        }

        return null;
    }

    /**
     * Campos ocultos del formulario (para no perder estado JSF al consultar).
     *
     * @return array<string, string>
     */
    public static function hiddenInputs(string $html, ?string $formId = null): array
    {
        $campos = [];
        $patron = $formId
            ? '/<form[^>]*id="' . preg_quote($formId, '/') . '"[^>]*>(.*?)<\/form>/is'
            : '/<form[^>]*method="post"[^>]*>(.*?)<\/form>/is';

        if (!preg_match($patron, $html, $form)) {
            return $campos;
        }

        if (preg_match_all(
            '/<input[^>]+type="hidden"[^>]*name="([^"]+)"[^>]*value="([^"]*)"/i',
            $form[1],
            $matches,
            PREG_SET_ORDER
        )) {
            foreach ($matches as $match) {
                $campos[$match[1]] = html_entity_decode($match[2], ENT_QUOTES);
            }
        }

        return $campos;
    }

    /**
     * Intenta localizar nombres de campo de fecha en el HTML (varían por versión del portal).
     *
     * @return array{desde: ?string, hasta: ?string}
     */
    public static function detectarCamposFecha(string $html): array
    {
        $desde = null;
        $hasta = null;

        if (preg_match('/name="([^"]*fecha[^"]*ini[^"]*|[^"]*desde[^"]*)"[^>]*type="text"/i', $html, $m)) {
            $desde = $m[1];
        }
        if (preg_match('/name="([^"]*fecha[^"]*fin[^"]*|[^"]*hasta[^"]*)"[^>]*type="text"/i', $html, $m)) {
            $hasta = $m[1];
        }

        return ['desde' => $desde, 'hasta' => $hasta];
    }

    /**
     * Enlaces de descarga XML en la tabla de resultados.
     *
     * @return list<string>
     */
    public static function enlacesXml(string $html): array
    {
        $enlaces = [];
        if (preg_match_all('/href="([^"]+\.xml[^"]*|[^"]*descarga[^"]*xml[^"]*)"/i', $html, $m)) {
            foreach ($m[1] as $href) {
                $enlaces[] = html_entity_decode($href, ENT_QUOTES);
            }
        }

        return array_values(array_unique($enlaces));
    }
}
