<?php

declare(strict_types=1);

namespace Sri;

use Sri\Descargas\RutasDescarga;

/**
 * Carga configuración desde variables de entorno (.env en raíz php o proyecto).
 */
final class Config
{
    public readonly string $sessionFile;
    public readonly string $ruc;
    public readonly string $host;
    public readonly string $userAgent;
    public readonly string $urlComprobantes;
    public readonly string $descargasDir;

    public function __construct()
    {
        $this->ruc = getenv('SRI_RUC') ?: '';
        $rucLimpio = preg_replace('/\D/', '', $this->ruc) ?: 'sin-ruc';
        $sessionRel = getenv('SRI_SESSION_FILE')
            ?: ('var/sessions/' . $rucLimpio . '/sri-storage-state.json');
        $this->sessionFile = $this->absPath($sessionRel);
        $this->host = getenv('SRI_HOST') ?: 'srienlinea.sri.gob.ec';
        $this->userAgent = getenv('SRI_USER_AGENT')
            ?: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        $this->urlComprobantes = getenv('SRI_URL_COMPROBANTES')
            ?: 'https://srienlinea.sri.gob.ec/comprobantes-electronicos-internet/pages/consultas/recibidos/comprobantesRecibidos.jsf';
        $this->descargasDir = $this->absPath(getenv('DESCARGAS_DIR') ?: 'var/descargas');
    }

    public function rutasDescarga(): RutasDescarga
    {
        return new RutasDescarga($this->descargasDir, $this->ruc);
    }

    /** Raíz del repo (carpeta api-documents), no php/ */
    private function raizProyecto(): string
    {
        return dirname(__DIR__, 2);
    }

    private function absPath(string $ruta): string
    {
        if ($ruta !== '' && $ruta[0] === '/') {
            return $ruta;
        }

        $normalizada = str_replace('\\', '/', $ruta);
        if (str_starts_with($normalizada, './')) {
            $normalizada = substr($normalizada, 2);
        }

        return $this->raizProyecto() . '/' . ltrim($normalizada, '/');
    }
}
