import { ApiProperty } from '@nestjs/swagger';

export class SetLineRepositoriesRequestDto {
  @ApiProperty({
    type: String,
    isArray: true,
    example: ['usespotlightai/spotlight'],
    description: 'The line’s repositories, as owner/name, set whole.',
  })
  readonly repositories!: string[];
}
