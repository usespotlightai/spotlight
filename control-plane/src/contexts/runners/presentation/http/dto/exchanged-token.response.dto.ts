import { ApiProperty } from '@nestjs/swagger';

export class ExchangedTokenResponseDto {
  @ApiProperty({ example: '3fd46417-95af-4c8b-9a3d-2b7e5f0c1d84' })
  readonly runnerId: string;

  @ApiProperty({
    example: 'xY3...',
    description:
      'The runner token to call with from now on; any token issued before under this name no longer works',
  })
  readonly token: string;

  constructor(runnerId: string, token: string) {
    this.runnerId = runnerId;
    this.token = token;
  }
}
