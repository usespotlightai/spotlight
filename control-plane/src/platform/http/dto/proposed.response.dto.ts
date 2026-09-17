import { ApiProperty } from '@nestjs/swagger';

export class ProposedResponseDto {
  @ApiProperty({ example: 'https://github.com/acme/api/pull/4' })
  readonly url: string;

  constructor(url: string) {
    this.url = url;
  }
}
