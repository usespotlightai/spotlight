import { ApiProperty } from '@nestjs/swagger';

export class BlockTaskRequestDto {
  @ApiProperty({
    type: String,
    isArray: true,
    example: ['a17c4e02-9b3d-4f61-8e5a-0c2d7b9f4a13'],
    description:
      'The tasks this task waits for, all of them. An empty list clears them.',
  })
  readonly blockedBy!: string[];
}
