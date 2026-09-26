import { ApiProperty } from '@nestjs/swagger';

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

  constructor(
    id: string,
    method: string,
    url: string,
    headers: Readonly<Record<string, string>>,
    body: string,
    timeoutMs: number,
  ) {
    this.id = id;
    this.method = method;
    this.url = url;
    this.headers = headers;
    this.body = body;
    this.timeoutMs = timeoutMs;
  }
}
