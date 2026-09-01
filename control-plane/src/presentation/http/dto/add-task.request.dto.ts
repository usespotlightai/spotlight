import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddTaskRequestDto {
  @ApiProperty({ example: 'Fix the queue', maxLength: 200 })
  readonly title!: string;

  @ApiPropertyOptional({
    example: '## Steps\n\nReproduce, then fix.',
    maxLength: 20000,
    nullable: true,
    type: String,
    description: 'Markdown. Left out or blank for a task with nothing said.',
  })
  readonly description?: string | null;

  @ApiPropertyOptional({
    example: 'usespotlightai/spotlight',
    nullable: true,
    type: String,
    description: 'The codebase the work is done in, as owner/name',
  })
  readonly repository?: string | null;
}
