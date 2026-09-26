import { ApiProperty } from '@nestjs/swagger';

export class CallbackNoteRequestDto {
  @ApiProperty({
    example: 'A DBA looked at the migration and it is safe to run online.',
    description: 'What to say on the task, as the hook',
  })
  readonly body!: string;
}
