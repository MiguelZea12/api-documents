<?php

declare(strict_types=1);

namespace Sri\Comprobantes;

use InvalidArgumentException;

/**
 * Periodo de consulta en el formulario SRI (año + mes / rango de meses).
 *
 * - Un solo mes:  mes=9
 * - Rango:       mesDesde=9, mesHasta=11  → sept, oct, nov (cada uno con día=Todos en el portal)
 * - Año entero:  sin mes ni rango → meses 1..12
 */
final class PeriodoConsulta
{
    public function __construct(
        public readonly int $anio,
        public readonly ?int $mes = null,
        public readonly ?int $mesDesde = null,
        public readonly ?int $mesHasta = null,
    ) {
        if ($anio < 2000 || $anio > (int) date('Y') + 1) {
            throw new InvalidArgumentException('Año fuera de rango: ' . $anio);
        }

        if ($mes !== null && ($mesDesde !== null || $mesHasta !== null)) {
            throw new InvalidArgumentException('Use --mes O --mes-desde/--mes-hasta, no ambos.');
        }

        foreach ([$mes, $mesDesde, $mesHasta] as $m) {
            if ($m !== null && ($m < 1 || $m > 12)) {
                throw new InvalidArgumentException('Mes inválido: ' . $m);
            }
        }

        if ($mesDesde !== null || $mesHasta !== null) {
            if ($mesDesde === null || $mesHasta === null) {
                throw new InvalidArgumentException('Debe indicar --mes-desde y --mes-hasta juntos.');
            }
            if ($mesDesde > $mesHasta) {
                throw new InvalidArgumentException('mes-desde no puede ser mayor que mes-hasta.');
            }
        }
    }

    /** @return list<int> Meses a consultar (cada consulta usa frmPrincipal:dia=0 = Todos) */
    public function meses(): array
    {
        if ($this->mes !== null) {
            return [$this->mes];
        }
        if ($this->mesDesde !== null && $this->mesHasta !== null) {
            return range($this->mesDesde, $this->mesHasta);
        }

        return range(1, 12);
    }

    public function etiqueta(): string
    {
        if ($this->mes !== null) {
            return sprintf('%04d-%02d', $this->anio, $this->mes);
        }
        if ($this->mesDesde !== null && $this->mesHasta !== null) {
            return sprintf(
                '%04d-%02d..%02d',
                $this->anio,
                $this->mesDesde,
                $this->mesHasta
            );
        }

        return (string) $this->anio;
    }
}
