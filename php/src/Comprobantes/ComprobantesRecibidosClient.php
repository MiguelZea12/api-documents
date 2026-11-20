<?php

declare(strict_types=1);

namespace Sri\Comprobantes;

use Sri\Config;
use Sri\Http\SriHttpClient;
use Sri\Http\SriHttpResponse;
use RuntimeException;

/**
 * Consulta comprobantes recibidos vía HTTP (formulario JSF / PrimeFaces).
 */
final class ComprobantesRecibidosClient
{
    private const FORM = 'frmPrincipal';
    private const BTN_BUSCAR = 'frmPrincipal:btnBuscar';

    private SriHttpClient $http;
    private ?string $htmlFormulario = null;

    public function __construct(private readonly Config $config)
    {
        $this->http = new SriHttpClient($config);
    }

    public function cargarPantallaConsulta(): SriHttpResponse
    {
        $resp = $this->http->get($this->config->urlComprobantes);
        if ($resp->esLogin()) {
            throw new RuntimeException('Sesión expirada. Vuelve a ejecutar: npm start');
        }

        $resp = $this->completarAutenticacionModulo($resp);

        if (!str_contains($resp->body, 'frmPrincipal')) {
            $resp = $this->http->get($this->config->urlComprobantes, $this->config->urlComprobantes);
        }

        if (!str_contains($resp->body, 'frmPrincipal')) {
            throw new RuntimeException(
                'No se cargó el formulario de consulta (frmPrincipal). Renueva sesión: npm start'
            );
        }

        $this->htmlFormulario = $resp->body;

        return $resp;
    }

    /**
     * El módulo JSF a veces responde con auto-submit a j_security_check antes del formulario real.
     */
    private function completarAutenticacionModulo(SriHttpResponse $resp): SriHttpResponse
    {
        if (!str_contains($resp->body, 'j_security_check')) {
            return $resp;
        }

        if (!preg_match('/action="([^"]*j_security_check[^"]*)"/', $resp->body, $action)) {
            return $resp;
        }

        $campos = [];
        foreach (['j_username', 'j_password', 'j_token'] as $nombre) {
            if (preg_match('/name="' . $nombre . '"\s+value="?([^"\s>]+)"?/', $resp->body, $m)) {
                $campos[$nombre] = $m[1];
            }
        }

        if ($campos === []) {
            return $resp;
        }

        $postUrl = $this->resolverUrl($action[1]);

        return $this->http->post($postUrl, $campos, $this->config->urlComprobantes);
    }

    private function resolverUrl(string $ruta): string
    {
        if (str_starts_with($ruta, 'http')) {
            return $ruta;
        }

        $base = preg_replace('#/[^/]*$#', '/', $this->config->urlComprobantes) ?? $this->config->urlComprobantes;

        return $base . ltrim($ruta, '/');
    }

    /**
     * Una consulta: año + mes + día (0=todos) + tipo de comprobante.
     */
    public function consultar(
        int $anio,
        int $mes,
        int $dia,
        string $tipoComprobante
    ): SriHttpResponse {
        if ($this->htmlFormulario === null) {
            $this->cargarPantallaConsulta();
        }

        $html = $this->htmlFormulario;
        $campos = JsfFormHelper::hiddenInputs($html, self::FORM);

        $viewState = JsfFormHelper::viewState($html);
        if ($viewState !== null) {
            $campos['javax.faces.ViewState'] = $viewState;
        }

        // ── Campos visibles del formulario (según DOM del SRI) ──
        $campos[self::FORM] = self::FORM;
        $campos['frmPrincipal:ano'] = (string) $anio;
        $campos['frmPrincipal:mes'] = (string) $mes;
        $campos['frmPrincipal:dia'] = (string) $dia;
        $campos['frmPrincipal:cmbTipoComprobante'] = $tipoComprobante;

        // PrimeFaces Ajax al pulsar "Consultar" (frmPrincipal:btnBuscar)
        $campos['javax.faces.partial.ajax'] = 'true';
        $campos['javax.faces.source'] = self::BTN_BUSCAR;
        $campos['javax.faces.partial.execute'] = self::FORM;
        $campos['javax.faces.partial.render'] =
            'frmPrincipal:panelListaComprobantes frmPrincipal:pnldocumentosrecibidos';
        $campos[self::BTN_BUSCAR] = self::BTN_BUSCAR;

        $resp = $this->http->postPrimeFaces(
            $this->config->urlComprobantes,
            $campos,
            $this->config->urlComprobantes
        );

        if ($resp->esLogin()) {
            throw new RuntimeException('Sesión expirada durante la consulta.');
        }

        // Actualizar ViewState / formulario para la siguiente consulta en la misma sesión
        $this->htmlFormulario = $this->fusionarRespuestaAjax($html, $resp->body);

        return $resp;
    }

    /**
     * Ejecuta todas las combinaciones del filtro (meses × tipos).
     *
     * @return list<string> Claves de acceso únicas
     */
    public function consultarFiltro(FiltroConsultaRecibidos $filtro): array
    {
        $claves = [];

        foreach ($filtro->meses() as $mes) {
            foreach ($filtro->tipos() as $tipo) {
                echo "[INFO] Consultando {$filtro->periodo->anio}-"
                    . str_pad((string) $mes, 2, '0', STR_PAD_LEFT)
                    . " dia={$filtro->dia} tipo=" . TiposComprobante::etiqueta($tipo) . "\n";

                $resp = $this->consultar(
                    $filtro->periodo->anio,
                    $mes,
                    $filtro->dia,
                    $tipo
                );

                $nuevas = TablaComprobantesParser::clavesAcceso($resp->body);
                echo '[OK] Claves en esta consulta: ' . count($nuevas) . PHP_EOL;

                if ($nuevas === [] && !TablaComprobantesParser::tieneTablaResultados($resp->body)) {
                    echo "[WARN] Sin tabla (reCAPTCHA). Usa: php bin/recibidos.php ...\n";
                }

                $claves = array_values(array_unique(array_merge($claves, $nuevas)));
            }
        }

        return $claves;
    }

    /**
     * PrimeFaces suele devolver fragmentos XML; si es HTML completo, reemplazar.
     */
    private function fusionarRespuestaAjax(string $htmlAnterior, string $cuerpoRespuesta): string
    {
        if (str_contains($cuerpoRespuesta, '<!DOCTYPE') || str_contains($cuerpoRespuesta, '<html')) {
            return $cuerpoRespuesta;
        }

        return $htmlAnterior . "\n" . $cuerpoRespuesta;
    }
}
