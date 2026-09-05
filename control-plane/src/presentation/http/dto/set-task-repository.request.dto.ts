import { ApiProperty } from '@nestjs/swagger';

export class SetTaskRepositoryRequestDto {
  @ApiProperty({
    example: 'usespotlightai/spotlight',
    nullable: true,
    type: String,
    description: 'The repository a run works it in, or null for none',
  })
  readonly repository!: string | null;
}
