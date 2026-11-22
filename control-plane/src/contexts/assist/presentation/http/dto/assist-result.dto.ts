import { ApiProperty } from '@nestjs/swagger';

export class SubmitAssistResultRequestDto {
  @ApiProperty({
    description:
      'The one JSON result of the assist session, in the shape its kind asks for',
  })
  readonly result!: unknown;
}

export class AssistResultAcceptedResponseDto {
  @ApiProperty({ enum: [true], example: true })
  readonly accepted = true as const;
}
