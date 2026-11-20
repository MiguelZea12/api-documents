<?php

declare(strict_types=1);

namespace Sri\Http;

use Sri\Config;
use Sri\Session\PlaywrightSessionLoader;

/**
 * Cliente HTTP con cURL: Cookie jar dinámico, User-Agent y Bearer opcional.
 */
final class SriHttpClient
{
    private PlaywrightSessionLoader $sesion;
    private SriCookieJar $jar;

    public function __construct(private readonly Config $config)
    {
        $this->sesion = new PlaywrightSessionLoader($config->sessionFile);
        $this->jar = new SriCookieJar();
        $this->jar->cargarDesdePlaywright($this->sesion->cookies());
    }

    public function get(string $url, ?string $referer = null): SriHttpResponse
    {
        return $this->request('GET', $url, null, $referer);
    }

    /**
     * @param array<string, string> $campos
     */
    public function post(string $url, array $campos, ?string $referer = null): SriHttpResponse
    {
        return $this->request('POST', $url, http_build_query($campos), $referer, false);
    }

    /**
     * POST Ajax PrimeFaces (botón Consultar del SRI).
     *
     * @param array<string, string> $campos
     */
    public function postPrimeFaces(string $url, array $campos, ?string $referer = null): SriHttpResponse
    {
        return $this->request('POST', $url, http_build_query($campos), $referer, true);
    }

    public function download(string $url, string $destino, ?string $referer = null): void
    {
        $resp = $this->request('GET', $url, null, $referer);
        if ($resp->status >= 400) {
            throw new \RuntimeException("Error al descargar {$url} (HTTP {$resp->status})");
        }
        file_put_contents($destino, $resp->body);
    }

    private function request(
        string $method,
        string $url,
        ?string $body,
        ?string $referer,
        bool $primeFacesAjax = false
    ): SriHttpResponse {
        $ch = \curl_init($url);
        $jar = $this->jar;

        $headers = [
            $primeFacesAjax
                ? 'Accept: application/xml, text/xml, */*; q=0.01'
                : 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language: es-EC,es;q=0.9',
            'Cookie: ' . $jar->cabeceraParaUrl($url),
        ];

        if ($primeFacesAjax) {
            $headers[] = 'Faces-Request: partial/ajax';
            $headers[] = 'X-Requested-With: XMLHttpRequest';
        }

        $token = $this->sesion->bearerToken();
        if ($token !== null) {
            $headers[] = 'Authorization: Bearer ' . $token;
        }

        if ($referer !== null) {
            $headers[] = 'Referer: ' . $referer;
        }

        $opts = [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT => 120,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_USERAGENT => $this->config->userAgent,
            CURLOPT_ENCODING => '',
            CURLOPT_HEADERFUNCTION => static function ($curl, string $header) use ($jar) {
                $jar->absorbirLineaSetCookie($header);

                return strlen($header);
            },
        ];

        if ($method === 'POST') {
            $opts[CURLOPT_POST] = true;
            $opts[CURLOPT_POSTFIELDS] = $body;
            $headers[] = 'Content-Type: application/x-www-form-urlencoded';
            $opts[CURLOPT_HTTPHEADER] = $headers;
        }

        \curl_setopt_array($ch, $opts);
        $responseBody = \curl_exec($ch);
        $status = (int) \curl_getinfo($ch, CURLINFO_HTTP_CODE);

        if ($responseBody === false) {
            $err = \curl_error($ch);
            \curl_close($ch);
            throw new \RuntimeException('cURL: ' . $err);
        }

        \curl_close($ch);

        return new SriHttpResponse($status, (string) $responseBody);
    }
}
