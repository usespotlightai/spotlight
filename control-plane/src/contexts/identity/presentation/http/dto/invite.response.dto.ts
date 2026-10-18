import type { InviteOutcome } from '@identity/application/dto/invite.dto';
import { TeamReferenceResponseDto } from '@identity/presentation/http/dto/team-reference.response.dto';
import { ApiProperty } from '@nestjs/swagger';

export class InviteOutcomeResponseDto {
  @ApiProperty({ example: 'ada@example.com' })
  readonly email!: string;

  @ApiProperty({
    description:
      'What came of the address: a new invitation, a pending one resent with a fresh link, nothing, since they are already in the workspace, or an invitation stored whose email could not be sent. Resend it to try again.',
    enum: ['invited', 'resent', 'already-a-member', 'not-sent'],
    example: 'invited',
  })
  readonly outcome!: InviteOutcome;
}

export class InviteOutcomesResponseDto {
  @ApiProperty({
    description:
      'One outcome per address in the request, in the order of the request.',
    type: InviteOutcomeResponseDto,
    isArray: true,
  })
  readonly outcomes!: readonly InviteOutcomeResponseDto[];
}

export class InviterResponseDto {
  @ApiProperty({ example: 'a17c4e02-9b3d-4f61-8e5a-0c2d7b9f4a13' })
  readonly id!: string;

  @ApiProperty({ example: 'Leon Liang' })
  readonly name!: string;

  @ApiProperty({ type: String, nullable: true })
  readonly image!: string | null;
}

export class WorkspaceInviteResponseDto {
  @ApiProperty({ example: 'a17c4e02-9b3d-4f61-8e5a-0c2d7b9f4a13' })
  readonly id!: string;

  @ApiProperty({ example: 'ada@example.com' })
  readonly email!: string;

  @ApiProperty({
    description: 'What they will be in the workspace once they accept.',
    enum: ['admin', 'member'],
    example: 'member',
  })
  readonly role!: 'admin' | 'member';

  @ApiProperty({
    description: 'The teams they join on accepting.',
    type: TeamReferenceResponseDto,
    isArray: true,
  })
  readonly teams!: readonly TeamReferenceResponseDto[];

  @ApiProperty({
    description: 'Who invited them, or null once their account is deleted.',
    type: InviterResponseDto,
    nullable: true,
  })
  readonly invitedBy!: InviterResponseDto | null;

  @ApiProperty({ example: '2026-09-12T09:00:00.000Z' })
  readonly invitedAt!: string;

  @ApiProperty({ example: '2026-09-26T09:00:00.000Z' })
  readonly expiresAt!: string;
}

export class InvitePreviewResponseDto {
  @ApiProperty({
    description: 'The address it was sent to, which is who may accept it.',
    example: 'ada@example.com',
  })
  readonly email!: string;

  @ApiProperty({ example: 'Acme' })
  readonly workspaceName!: string;

  @ApiProperty({
    description: 'Who invited them, or null once their account is deleted.',
    type: String,
    nullable: true,
    example: 'Leon Liang',
  })
  readonly invitedBy!: string | null;

  @ApiProperty({
    description: 'What they will be in the workspace once they accept.',
    enum: ['admin', 'member'],
    example: 'member',
  })
  readonly role!: 'admin' | 'member';

  @ApiProperty({
    description: 'The teams they join on accepting.',
    example: ['Platform'],
    type: String,
    isArray: true,
  })
  readonly teamNames!: readonly string[];

  @ApiProperty({
    description: 'Whether it is still worth following.',
    enum: ['pending', 'accepted', 'revoked', 'expired'],
    example: 'pending',
  })
  readonly status!: 'pending' | 'accepted' | 'revoked' | 'expired';
}

export class JoinedWorkspaceResponseDto {
  @ApiProperty({ description: 'Where they land.', example: 'acme' })
  readonly workspaceSlug!: string;
}
