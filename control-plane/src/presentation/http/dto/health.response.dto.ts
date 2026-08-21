import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ example: 'ok', enum: ['ok'] })
  readonly status: 'ok';

  constructor() {
    this.status = 'ok';
  }
}
