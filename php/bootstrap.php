<?php

declare(strict_types=1);

/**
 * Autoload con Composer si existe; si no, PSR-4 manual (sin composer install).
 */
if (is_readable(__DIR__ . '/vendor/autoload.php')) {
    require __DIR__ . '/vendor/autoload.php';
} else {
    spl_autoload_register(static function (string $class): void {
        $prefix = 'Sri\\';
        if (!str_starts_with($class, $prefix)) {
            return;
        }
        $rel = str_replace('\\', '/', substr($class, strlen($prefix)));
        $file = __DIR__ . '/src/' . $rel . '.php';
        if (is_readable($file)) {
            require $file;
        }
    });
}

/** Carga variables KEY=valor desde .env */
function cargarDotEnv(string $ruta): void
{
    if (!is_readable($ruta)) {
        return;
    }
    foreach (file($ruta, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $linea) {
        $linea = trim($linea);
        if ($linea === '' || str_starts_with($linea, '#')) {
            continue;
        }
        if (!str_contains($linea, '=')) {
            continue;
        }
        [$clave, $valor] = explode('=', $linea, 2);
        $clave = trim($clave);
        $valor = trim($valor, " \t\"'");
        if (getenv($clave) === false) {
            putenv("{$clave}={$valor}");
            $_ENV[$clave] = $valor;
        }
    }
}

cargarDotEnv(__DIR__ . '/.env');
cargarDotEnv(__DIR__ . '/../.env');

if (!\extension_loaded('curl')) {
    fwrite(STDERR, "[ERROR] Falta la extensión PHP cURL. Instala: sudo apt install php-curl\n");
    exit(1);
}
if (!\extension_loaded('dom') && !\function_exists('preg_match')) {
    fwrite(STDERR, "[ERROR] Falta PHP DOM o PCRE para leer XML de facturas.\n");
    exit(1);
}
