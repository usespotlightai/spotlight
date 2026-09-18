import { ApiProperty } from '@nestjs/swagger';

export class RegisteredRunnerResponseDto {
  @ApiProperty({ example: '3fd46417-95af-4c8b-9a3d-2b7e5f0c1d84' })
  readonly runnerId: string;

  constructor(runnerId: string) {
    this.runnerId = runnerId;
  }
}
