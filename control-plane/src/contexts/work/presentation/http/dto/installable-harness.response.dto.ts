import { ApiProperty } from '@nestjs/swagger';

export class InstallableHarnessResponseDto {
  @ApiProperty({ example: 'claude-code' })
  readonly id: string;

  @ApiProperty({
    example: 'claude',
    description: 'What to look for on the runner’s PATH.',
  })
  readonly executable: string;

  @ApiProperty({
    type: String,
    isArray: true,
    example: ['cursor-agent', 'models'],
    description:
      'What to run to list this harness’s models, argv-style. Empty where ' +
      'the CLI cannot enumerate them.',
  })
  readonly discovery: readonly string[];

  constructor(id: string, executable: string, discovery: readonly string[]) {
    this.id = id;
    this.executable = executable;
    this.discovery = discovery;
  }
}
