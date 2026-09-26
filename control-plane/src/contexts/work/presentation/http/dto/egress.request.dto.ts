import { ApiProperty } from '@nestjs/swagger';

export class RedeemEgressRequestDto {
  @ApiProperty({
    example: 'p8kX0q1cVJ3Q0x4yQ2a6m0dD6b8hT3n1gC9sZ7rW2Ek=',
    description:
      'The X25519 public key egress holds for this run alone, in base64; values Spotlight keeps are sealed to it',
  })
  readonly recipient!: string;
}
