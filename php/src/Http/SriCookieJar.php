<?php

declare(strict_types=1);

namespace Sri\Http;

/**
 * Mantiene cookies entre peticiones cURL (Set-Cookie tras j_security_check, etc.).
 */
final class SriCookieJar
{
    /** @var list<array{name: string, value: string, domain: string, path: string}> */
    private array $cookies = [];

    /**
     * @param list<array<string, mixed>> $cookiesPlaywright
     */
    public function cargarDesdePlaywright(array $cookiesPlaywright): void
    {
        foreach ($cookiesPlaywright as $c) {
            $this->cookies[] = [
                'name' => (string) $c['name'],
                'value' => (string) $c['value'],
                'domain' => (string) ($c['domain'] ?? ''),
                'path' => (string) ($c['path'] ?? '/'),
            ];
        }
    }

    public function absorbirLineaSetCookie(string $linea): void
    {
        if (!str_starts_with(strtolower($linea), 'set-cookie:')) {
            return;
        }

        $parte = trim(substr($linea, strlen('Set-Cookie:')));
        $segmentos = explode(';', $parte);
        $par = explode('=', $segmentos[0], 2);
        if (count($par) !== 2) {
            return;
        }

        [$nombre, $valor] = $par;
        $path = '/';
        $domain = '';

        foreach (array_slice($segmentos, 1) as $attr) {
            $attr = trim($attr);
            if (stripos($attr, 'path=') === 0) {
                $path = substr($attr, 5);
            }
            if (stripos($attr, 'domain=') === 0) {
                $domain = ltrim(substr($attr, 7), '.');
            }
        }

        $this->reemplazarOCrear($nombre, $valor, $domain, $path);
    }

    public function cabeceraParaUrl(string $url): string
    {
        $host = (string) parse_url($url, PHP_URL_HOST);
        $path = (string) (parse_url($url, PHP_URL_PATH) ?? '/');

        $partes = [];
        foreach ($this->cookies as $c) {
            if ($c['domain'] !== '' && !str_ends_with($host, $c['domain'])) {
                continue;
            }
            if (!str_starts_with($path, $c['path'])) {
                continue;
            }
            $partes[] = $c['name'] . '=' . $c['value'];
        }

        if ($partes === []) {
            throw new \RuntimeException('No hay cookies aplicables para la URL ' . $url);
        }

        return implode('; ', $partes);
    }

    private function reemplazarOCrear(string $nombre, string $valor, string $domain, string $path): void
    {
        foreach ($this->cookies as $i => $c) {
            if ($c['name'] === $nombre && $c['path'] === $path) {
                $this->cookies[$i]['value'] = $valor;
                if ($domain !== '') {
                    $this->cookies[$i]['domain'] = $domain;
                }

                return;
            }
        }

        $this->cookies[] = [
            'name' => $nombre,
            'value' => $valor,
            'domain' => $domain !== '' ? $domain : 'srienlinea.sri.gob.ec',
            'path' => $path === '' ? '/' : $path,
        ];
    }
}
