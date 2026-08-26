import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RunInputResponseDto {
  @ApiPropertyOptional({ example: 'bHMgLWxhCg==' })
  readonly data?: string;

  @ApiPropertyOptional({ example: 120 })
  readonly cols?: number;

  @ApiPropertyOptional({ example: 40 })
  readonly rows?: number;

  @ApiPropertyOptional({
    example: true,
    description: 'The agent has been asked to finish',
  })
  readonly stop?: boolean;

  constructor(data?: string, cols?: number, rows?: number, stop?: boolean) {
    this.data = data;
    this.cols = cols;
    this.rows = rows;
    this.stop = stop;
  }
}

export class PendingRunInputResponseDto {
  @ApiProperty({
    type: RunInputResponseDto,
    isArray: true,
    description: 'Empty when the poll timed out with nothing typed',
  })
  readonly input: RunInputResponseDto[];

  constructor(input: RunInputResponseDto[]) {
    this.input = input;
  }
}
