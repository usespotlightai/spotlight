import { ApiProperty } from '@nestjs/swagger';

export class EnrolRunnerRequestDto {
  @ApiProperty({
    example: 'Build server',
    description: 'What to call this runner. Rejected if empty or over 60.',
  })
  readonly name!: string;
}
