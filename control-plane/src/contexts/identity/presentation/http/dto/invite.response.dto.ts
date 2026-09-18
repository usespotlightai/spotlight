import { ApiProperty } from '@nestjs/swagger';

export class InviteResponseDto {
  @ApiProperty({ example: 'a17c4e02-9b3d-4f61-8e5a-0c2d7b9f4a13' })
  readonly id!: string;

  @ApiProperty({ example: 'ada@example.com' })
  readonly email!: string;

  @ApiProperty({ description: 'Who asked them.', example: 'Leon Liang' })
  readonly invitedBy!: string;

  @ApiProperty({ example: '2026-09-12T09:00:00.000Z' })
  readonly invitedAt!: string;

  @ApiProperty({ example: '2026-09-26T09:00:00.000Z' })
  readonly expiresAt!: string;
}

export class InviteOfferResponseDto {
  @ApiProperty({
    description: 'The address it was sent to, which is who may accept it.',
    example: 'ada@example.com',
  })
  readonly email!: string;

  @ApiProperty({ example: 'Platform' })
  readonly teamName!: string;

  @ApiProperty({ example: 'Acme' })
  readonly workspaceName!: string;

  @ApiProperty({ example: 'Leon Liang' })
  readonly invitedBy!: string;

  @ApiProperty({
    description: 'Whether it is still worth following.',
    enum: ['open', 'accepted', 'revoked', 'expired'],
    example: 'open',
  })
  readonly standing!: 'open' | 'accepted' | 'revoked' | 'expired';
}

export class JoinedTeamResponseDto {
  @ApiProperty({ example: 'acme' })
  readonly workspaceSlug!: string;

  @ApiProperty({ example: 'team_1' })
  readonly teamId!: string;

  @ApiProperty({ example: 'Platform' })
  readonly teamName!: string;
}
