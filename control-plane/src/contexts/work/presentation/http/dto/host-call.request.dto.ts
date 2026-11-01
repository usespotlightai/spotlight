import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ClaimHostCallRequestDto {
  @ApiProperty({
    example: 'K7Q2M4ZC3VYH6N5RB8WX1TDJ9P',
    description: 'The host claiming, as it names itself in its heartbeat',
  })
  readonly host!: string;
}

export class RecordHostCallResponseRequestDto {
  @ApiProperty({
    example: 'K7Q2M4ZC3VYH6N5RB8WX1TDJ9P',
    description:
      'The host that records the response, the one that claimed the call',
  })
  readonly host!: string;

  @ApiProperty({
    example: 200,
    description: 'The HTTP status of the response, or 0 when no response came',
  })
  readonly status!: number;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { type: 'string' },
    example: { 'content-type': 'application/json' },
    description: 'The headers of the response',
  })
  readonly headers?: Record<string, string>;

  @ApiPropertyOptional({
    example: 'eyJyZWZ1c2UiOiAibm90IHRvZGF5In0=',
    description: 'The body of the response, base64, at most 256 KiB',
  })
  readonly body?: string;

  @ApiProperty({
    example: 184,
    description: 'How long the call took to get a response, in milliseconds',
  })
  readonly ms!: number;

  @ApiPropertyOptional({
    example: 'dial tcp 10.0.4.2:443: connection refused',
    description: 'Why no response came, when the status is 0',
  })
  readonly error?: string;
}

export class RedeemCallSecretsRequestDto {
  @ApiProperty({
    example: 'K7Q2M4ZC3VYH6N5RB8WX1TDJ9P',
    description: 'The host that claimed the call',
  })
  readonly host!: string;

  @ApiProperty({
    example: 'k3Jx9vQ2mT7wZ1pL5nR8yC4bH6dF0sGa',
    description: 'The secrets token that the claim gave',
  })
  readonly token!: string;

  @ApiProperty({
    example: 'pQm3rT9xW2vY7zK1nB5cD8fG4hJ6kL0sA3eR9tU2iO8=',
    description:
      'The X25519 public key to seal the values to, 32 bytes in base64',
  })
  readonly recipient!: string;
}
