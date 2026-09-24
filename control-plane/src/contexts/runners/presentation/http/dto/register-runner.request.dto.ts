import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisteredHarnessRequestDto {
  @ApiProperty({ example: 'claude-code' })
  readonly id!: string;

  @ApiPropertyOptional({
    type: String,
    isArray: true,
    example: ['claude-sonnet-5', 'claude-opus-4-8'],
    description:
      'The models this harness reported it can answer with, discovered by ' +
      'the runner from the CLI. Empty where the CLI could not enumerate them.',
  })
  readonly models?: string[];

  @ApiPropertyOptional({
    example: '2.1.270',
    description:
      'The release of this harness the runner found installed, so a station ' +
      'pinned to a release only runs where that release is.',
  })
  readonly version?: string;
}

export class RegisterRunnerRequestDto {
  @ApiPropertyOptional({
    type: [RegisteredHarnessRequestDto],
    isArray: true,
    description:
      'The harnesses the runner found installed, each with the models it ' +
      'discovered. What is on a machine is a fact about that machine, so the ' +
      'machine is what says it.',
  })
  readonly harnesses?: RegisteredHarnessRequestDto[];
}
