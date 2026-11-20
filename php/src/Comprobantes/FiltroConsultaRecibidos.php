<?php

declare(strict_types=1);

namespace Sri\Comprobantes;

/**
 * Parámetros reales del formulario "Comprobantes electrónicos recibidos".
 *
 * Campos HTML del SRI:
 *   frmPrincipal:ano, frmPrincipal:mes, frmPrincipal:dia (0 = Todos),
 *   frmPrincipal:cmbTipoComprobante, frmPrincipal:btnBuscar
 */
final class FiltroConsultaRecibidos
{
    public function __construct(
        public readonly PeriodoConsulta $periodo,
        public readonly int $dia = 0,
        /** @var list<string>|null null = consultar todos los tipos de comprobante */
        public readonly ?array $tiposComprobante = null,
    ) {
        if ($dia < 0 || $dia > 31) {
            throw new \InvalidArgumentException('Día inválido (use 0 = Todos)');
        }
    }

    /** @return list<int> Meses a consultar */
    public function meses(): array
    {
        return $this->periodo->meses();
    }

    /** @return list<string> */
    public function tipos(): array
    {
        return $this->tiposComprobante ?? TiposComprobante::todos();
    }
}
