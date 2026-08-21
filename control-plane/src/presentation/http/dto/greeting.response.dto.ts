import { ApiProperty } from '@nestjs/swagger';

export class GreetingResponseDto {
  @ApiProperty({ example: 'Hello World!' })
  readonly message: string;

  constructor(message: string) {
    this.message = message;
  }
}
