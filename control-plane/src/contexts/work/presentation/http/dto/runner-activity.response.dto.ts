import { ApiProperty } from '@nestjs/swagger';

export class HeldRunResponseDto {
  @ApiProperty({ example: '3f9c1b7e-52a4-4d6f-8e1b-0a7c4d2f9b63' })
  readonly id: string;

  @ApiProperty({ example: 'claimed' })
  readonly state: string;

  constructor(id: string, state: string) {
    this.id = id;
    this.state = state;
  }
}

export class RunnerActivityResponseDto {
  @ApiProperty({ example: '8a1d4e0b-6c72-4f35-9b8a-1e5d3c7f2a49' })
  readonly runnerId: string;

  @ApiProperty({
    type: HeldRunResponseDto,
    description: 'The run the runner is working on',
  })
  readonly currentRun: HeldRunResponseDto;

  constructor(runnerId: string, currentRun: HeldRunResponseDto) {
    this.runnerId = runnerId;
    this.currentRun = currentRun;
  }
}
