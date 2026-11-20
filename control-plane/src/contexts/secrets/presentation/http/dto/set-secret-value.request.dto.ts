import { ApiProperty } from '@nestjs/swagger';

export class SetSecretValueRequestDto {
  @ApiProperty({
    example: 'correct-horse-battery-staple',
    description:
      'The new value, on one line if the secret is bound to a host. Spotlight encrypts it and never returns it',
    writeOnly: true,
  })
  readonly value!: string;
}
