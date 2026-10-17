import { ApiProperty } from '@nestjs/swagger';

export class ArchiveGrantResponseDto {
  @ApiProperty({ example: '0b6f3c2e-6c55-4b8e-9d7a-2f4e1a9c8d31' })
  readonly id: string;

  @ApiProperty({
    description:
      'Where to PUT the archive, for a quarter of an hour; the upload must carry every header given',
  })
  readonly url: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    example: {
      'content-type': 'application/gzip',
      'x-amz-checksum-sha256': 'nywdDot6b15NPCsaD56NfG5Kp9PS0bmo9+bWxLOqLxA=',
    },
  })
  readonly headers: Readonly<Record<string, string>>;

  constructor(
    id: string,
    url: string,
    headers: Readonly<Record<string, string>>,
  ) {
    this.id = id;
    this.url = url;
    this.headers = headers;
  }
}

export class StoredArchiveResponseDto {
  @ApiProperty({ example: '0b6f3c2e-6c55-4b8e-9d7a-2f4e1a9c8d31' })
  readonly id: string;

  @ApiProperty({
    description: 'Where to GET the archive, for a quarter of an hour',
  })
  readonly url: string;

  @ApiProperty({ example: 48_213_551 })
  readonly size: number;

  @ApiProperty({
    example: '9f2c1d0e8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f10',
  })
  readonly sha256: string;

  constructor(id: string, url: string, size: number, sha256: string) {
    this.id = id;
    this.url = url;
    this.size = size;
    this.sha256 = sha256;
  }
}
