import { ApiProperty } from '@nestjs/swagger';

export class RepositoryResponseDto {
  @ApiProperty({
    example: 'usespotlightai/spotlight',
    description: 'Named the way GitHub names it, owner and all',
  })
  readonly fullName: string;

  constructor(fullName: string) {
    this.fullName = fullName;
  }
}
