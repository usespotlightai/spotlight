import { ApiProperty } from '@nestjs/swagger';

export class EventRedeliveryResponseDto {
  @ApiProperty({
    example: 12,
    description:
      'How many dead letters Spotlight queued again. Each gets all its attempts again',
  })
  readonly count: number;

  constructor(count: number) {
    this.count = count;
  }
}
