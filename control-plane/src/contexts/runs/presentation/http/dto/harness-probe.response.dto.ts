import { ApiProperty } from '@nestjs/swagger';

export class HarnessProbeResponseDto {
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

  @ApiProperty({
    type: String,
    isArray: true,
    example: ['cursor-agent', '--version'],
    description:
      'What to run to learn which release of this harness is installed, ' +
      'argv-style; the first version-shaped word it prints is the release.',
  })
  readonly versionProbe: readonly string[];

  constructor(
    id: string,
    executable: string,
    discovery: readonly string[],
    versionProbe: readonly string[],
  ) {
    this.id = id;
    this.executable = executable;
    this.discovery = discovery;
    this.versionProbe = versionProbe;
  }
}
