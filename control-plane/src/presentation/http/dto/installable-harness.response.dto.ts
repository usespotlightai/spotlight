import { ApiProperty } from '@nestjs/swagger';

export class InstallableHarnessResponseDto {
  @ApiProperty({ example: 'claude-code' })
  readonly id: string;

  @ApiProperty({
    example: 'claude',
    description: 'What to look for on the runner’s PATH.',
  })
  readonly executable: string;

  constructor(id: string, executable: string) {
    this.id = id;
    this.executable = executable;
  }
}
