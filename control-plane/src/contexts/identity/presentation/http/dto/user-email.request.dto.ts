import { ApiProperty } from '@nestjs/swagger';

export class AddUserEmailRequestDto {
  @ApiProperty({
    description:
      'Another address of yours, for example the one your Slack account uses. Spotlight sends a verification link to it.',
    example: 'ada@work.example.com',
  })
  readonly email!: string;
}
