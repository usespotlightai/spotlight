import { ApiProperty } from '@nestjs/swagger';

export class EditorConnectionStateResponseDto {
  @ApiProperty({
    example: true,
    description: 'An editor holds an editor lease on the sandbox now',
  })
  readonly connected: boolean;

  constructor(connected: boolean) {
    this.connected = connected;
  }
}
