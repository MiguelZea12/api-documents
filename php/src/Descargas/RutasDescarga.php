<?php

declare(strict_types=1);

namespace Sri\Descargas;

/**
 * Rutas bajo var/descargas/{ruc}/{recibidos|emitidos}/{periodo}/.
 * Un contribuyente por .env (SRI_RUC); varios clientes = varias carpetas o varios .env.
 */
final class RutasDescarga
{
    public function __construct(
        private readonly string $baseDir,
        private readonly string $ruc,
    ) {
    }

    public function segmentoRuc(): string
    {
        $soloDigitos = preg_replace('/\D/', '', $this->ruc) ?? '';

        return $soloDigitos !== '' ? $soloDigitos : 'sin-ruc';
    }

    /**
     * @param 'recibidos'|'emitidos' $tipo
     */
    public function dir(string $tipo, string $periodo): string
    {
        if ($tipo !== 'recibidos' && $tipo !== 'emitidos') {
            throw new \InvalidArgumentException('tipo debe ser recibidos o emitidos');
        }

        $periodo = str_replace(['..', '\\'], ['', '/'], trim($periodo));
        if ($periodo === '') {
            throw new \InvalidArgumentException('periodo vacío');
        }

        return rtrim($this->baseDir, '/')
            . '/' . $this->segmentoRuc()
            . '/' . $tipo
            . '/' . $periodo;
    }
}
