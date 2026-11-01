import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class HostCallResponseDto {
  @ApiProperty({
    example: 'a3f1c2d4-5b6e-4f70-8a91-b2c3d4e5f607',
    description: 'The call, to answer by once it has been sent',
  })
  readonly id: string;

  @ApiProperty({ example: 'POST', description: 'The method to send with' })
  readonly method: string;

  @ApiProperty({
    example: 'http://audit.internal:8080/hooks',
    description: 'Where to send it, from inside the host’s network',
  })
  readonly url: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    example: { 'content-type': 'application/json' },
    description: 'Sent with the body, exactly as given',
  })
  readonly headers: Readonly<Record<string, string>>;

  @ApiProperty({
    example: 'eyJob29rIjogImNvcmUvYXVkaXQifQ==',
    description: 'The body to send, base64',
  })
  readonly body: string;

  @ApiProperty({
    example: 10_000,
    description: 'How long to wait for an answer, in milliseconds',
  })
  readonly timeoutMs: number;

  @ApiPropertyOptional({
    example: 'k3Jx9vQ2mT7wZ1pL5nR8yC4bH6dF0sGa',
    description:
      'Given only when the call names secrets. Egress redeems the secrets with it once, sealed to a key that it makes for this call alone',
  })
  readonly secretsToken?: string;

  constructor(
    id: string,
    method: string,
    url: string,
    headers: Readonly<Record<string, string>>,
    body: string,
    timeoutMs: number,
    secretsToken: string | null,
  ) {
    this.id = id;
    this.method = method;
    this.url = url;
    this.headers = headers;
    this.body = body;
    this.timeoutMs = timeoutMs;
    if (secretsToken !== null) {
      this.secretsToken = secretsToken;
    }
  }
}
