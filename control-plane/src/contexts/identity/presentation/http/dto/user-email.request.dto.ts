import { ApiProperty } from '@nestjs/swagger';

export class AddUserEmailRequestDto {
  @ApiProperty({
    description:
      'Another email address you use across connected services. Spotlight sends a verification link to it.',
    example: 'ada@work.example.com',
  })
  readonly email!: string;
}
