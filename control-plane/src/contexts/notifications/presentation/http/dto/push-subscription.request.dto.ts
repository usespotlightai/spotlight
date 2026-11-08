import { ApiProperty } from '@nestjs/swagger';

class PushSubscriptionKeysRequestDto {
  @ApiProperty({
    description: 'The public key of the browser, base64url',
    example:
      'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM',
  })
  readonly p256dh!: string;

  @ApiProperty({
    description: 'The authentication secret of the browser, base64url',
    example: 'tBHItJI5svbpez7KI4CCXg',
  })
  readonly auth!: string;
}

export class PushSubscriptionRequestDto {
  @ApiProperty({
    description: 'The push service address the browser gave',
    example: 'https://fcm.googleapis.com/fcm/send/c1KrmpTuRm0',
  })
  readonly endpoint!: string;

  @ApiProperty({ type: PushSubscriptionKeysRequestDto })
  readonly keys!: PushSubscriptionKeysRequestDto;
}

export class PushUnsubscriptionRequestDto {
  @ApiProperty({
    description: 'The push service address to stop sending to',
    example: 'https://fcm.googleapis.com/fcm/send/c1KrmpTuRm0',
  })
  readonly endpoint!: string;
}
