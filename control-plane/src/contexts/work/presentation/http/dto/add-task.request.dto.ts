import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddTaskRequestDto {
  @ApiProperty({ example: 'Fix the queue', maxLength: 200 })
  readonly title!: string;

  @ApiPropertyOptional({
    example: '## Steps\n\nReproduce, then fix.',
    maxLength: 20000,
    nullable: true,
    type: String,
    description: 'Markdown. Left out or blank for a task with no description.',
  })
  readonly description?: string | null;

  @ApiPropertyOptional({
    type: String,
    isArray: true,
    description: 'Uploads to attach, by the id each was granted',
  })
  readonly attachments?: string[];
}
