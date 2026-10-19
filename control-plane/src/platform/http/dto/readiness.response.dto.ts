import { ApiProperty } from '@nestjs/swagger';

export class ReadinessCheckDto {
  @ApiProperty({ example: 'postgres' })
  readonly name: string;

  @ApiProperty({ example: 'ok', enum: ['ok', 'failed'] })
  readonly status: 'ok' | 'failed';

  constructor(name: string, status: 'ok' | 'failed') {
    this.name = name;
    this.status = status;
  }
}

export class ReadinessResponseDto {
  @ApiProperty({ example: 'ready', enum: ['ready', 'not_ready'] })
  readonly status: 'ready' | 'not_ready';

  @ApiProperty({ type: [ReadinessCheckDto] })
  readonly checks: ReadinessCheckDto[];

  constructor(checks: ReadinessCheckDto[]) {
    this.checks = checks;
    this.status = checks.every((each) => each.status === 'ok')
      ? 'ready'
      : 'not_ready';
  }
}
