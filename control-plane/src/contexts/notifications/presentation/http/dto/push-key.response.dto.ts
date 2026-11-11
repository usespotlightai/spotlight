import { ApiProperty } from '@nestjs/swagger';

export class PushKeyResponseDto {
  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'The VAPID public key to subscribe with, base64url. Null when this Spotlight sends no Web Push.',
  })
  readonly publicKey!: string | null;
}
