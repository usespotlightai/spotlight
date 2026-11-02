import type { UserEmailStatus } from '@identity/domain/aggregates/user-email.aggregate';
import { ApiProperty } from '@nestjs/swagger';

export class UserEmailResponseDto {
  @ApiProperty({ example: 'a17c4e02-9b3d-4f61-8e5a-0c2d7b9f4a13' })
  readonly id!: string;

  @ApiProperty({ example: 'ada@work.example.com' })
  readonly email!: string;

  @ApiProperty({
    description:
      'Spotlight recognizes you by a verified address across connected services. A pending address waits for its link. An expired link needs a resend.',
    enum: ['verified', 'pending', 'expired'],
    example: 'verified',
  })
  readonly status!: UserEmailStatus;

  @ApiProperty({ format: 'date-time' })
  readonly addedAt!: string;

  @ApiProperty({
    format: 'date-time',
    description: 'When Spotlight last sent the verification link.',
  })
  readonly sentAt!: string;
}

export class UserEmailsResponseDto {
  @ApiProperty({
    description: 'The address you sign in with.',
    example: 'ada@example.com',
  })
  readonly signInEmail!: string;

  @ApiProperty({
    description: 'Your other addresses, oldest first.',
    type: UserEmailResponseDto,
    isArray: true,
  })
  readonly additional!: readonly UserEmailResponseDto[];
}
