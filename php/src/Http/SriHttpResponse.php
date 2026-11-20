<?php

declare(strict_types=1);

namespace Sri\Http;

final class SriHttpResponse
{
    public function __construct(
        public readonly int $status,
        public readonly string $body,
    ) {
    }

    public function esLogin(): bool
    {
        return str_contains($this->body, '/auth/realms/')
            || str_contains($this->body, 'kc-form-login');
    }
}
