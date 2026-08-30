import { ApiProperty } from '@nestjs/swagger';

export class HarnessResponseDto {
  @ApiProperty({ example: 'claude-code' })
  readonly id: string;

  @ApiProperty({ example: 'Claude Code' })
  readonly name: string;

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }
}
