<?php

declare(strict_types=1);

namespace Sri\Session;

use RuntimeException;

/**
 * Lee el JSON storageState de Playwright y arma cabeceras Cookie / Bearer.
 */
final class PlaywrightSessionLoader
{
    /** @var list<array<string, mixed>> */
    private array $cookies = [];

    /** @var list<array<string, mixed>> */
    private array $origins = [];

    public function __construct(private readonly string $rutaJson)
    {
        if (!is_readable($rutaJson)) {
            throw new RuntimeException(
                "No existe sesión en {$rutaJson}. Ejecuta primero: npm start"
            );
        }

        $data = json_decode(file_get_contents($rutaJson), true, 512, JSON_THROW_ON_ERROR);
        $this->cookies = $data['cookies'] ?? [];
        $this->origins = $data['origins'] ?? [];
    }

    /** @return list<array<string, mixed>> */
    public function cookies(): array
    {
        return $this->cookies;
    }

    /**
     * Cabecera Cookie para el host del SRI (p. ej. JSESSIONID).
     */
    public function cookieHeader(string $host): string
    {
        $partes = [];
        foreach ($this->cookies as $cookie) {
            $dominio = (string) ($cookie['domain'] ?? '');
            if (!str_contains($dominio, $host)) {
                continue;
            }
            $partes[] = $cookie['name'] . '=' . $cookie['value'];
        }

        if ($partes === []) {
            throw new RuntimeException('No hay cookies para el host ' . $host);
        }

        return implode('; ', $partes);
    }

    /**
     * Token Bearer si Playwright guardó localStorage del portal Angular.
     */
    public function bearerToken(): ?string
    {
        foreach ($this->origins as $origin) {
            foreach ($origin['localStorage'] ?? [] as $item) {
                $name = strtolower((string) ($item['name'] ?? ''));
                if (!str_contains($name, 'token') && !str_contains($name, 'access')) {
                    continue;
                }
                $valor = trim((string) ($item['value'] ?? ''));
                if ($valor !== '' && str_contains($valor, '.')) {
                    return $valor;
                }
            }
        }

        return null;
    }
}
