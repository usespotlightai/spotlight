import { ApiProperty } from '@nestjs/swagger';

export class AnalyseTracesRequestDto {
  @ApiProperty({
    type: [String],
    example: ['a17c4e02-9b3d-4f61-8e5a-0c2d7b9f4a13'],
    description:
      'The tasks whose traces are to be analysed, one work item each',
  })
  readonly taskIds!: string[];
}
