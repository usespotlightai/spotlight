import { ApiProperty } from '@nestjs/swagger';

export class HarnessModelResponseDto {
  @ApiProperty({ example: 'claude-sonnet-5' })
  readonly id: string;

  @ApiProperty({ example: 'Sonnet 5' })
  readonly name: string;

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }
}

export class HarnessResponseDto {
  @ApiProperty({ example: 'claude-code' })
  readonly id: string;

  @ApiProperty({ example: 'Claude Code' })
  readonly name: string;

  @ApiProperty({ type: HarnessModelResponseDto, isArray: true })
  readonly models: readonly HarnessModelResponseDto[];

  @ApiProperty({
    example: 'claude-sonnet-5',
    description: 'Which model a station runs on where it names none of its own',
  })
  readonly defaultModel: string;

  @ApiProperty({
    type: String,
    isArray: true,
    example: ['low', 'medium', 'high', 'xhigh', 'max'],
    description:
      'The effort levels this harness offers. Empty where it takes none.',
  })
  readonly efforts: readonly string[];

  constructor(
    id: string,
    name: string,
    models: readonly HarnessModelResponseDto[],
    defaultModel: string,
    efforts: readonly string[],
  ) {
    this.id = id;
    this.name = name;
    this.models = models;
    this.defaultModel = defaultModel;
    this.efforts = efforts;
  }
}
