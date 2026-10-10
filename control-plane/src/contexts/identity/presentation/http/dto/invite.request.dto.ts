import { MOST_INVITED_AT_ONCE } from '@identity/application/commands/invite-to-workspace.command';
import { ApiProperty } from '@nestjs/swagger';

export class InviteToWorkspaceRequestDto {
  @ApiProperty({
    description:
      'Where each invitation is sent, and who may accept it. One invitation per address.',
    example: ['ada@example.com', 'grace@example.com'],
    type: String,
    isArray: true,
    minItems: 1,
    maxItems: MOST_INVITED_AT_ONCE,
  })
  readonly emails!: string[];

  @ApiProperty({
    description:
      'What they will be in the workspace once they accept. Nobody is invited as an owner, nor above the inviter.',
    enum: ['admin', 'member'],
    example: 'member',
  })
  readonly role!: 'admin' | 'member';

  @ApiProperty({
    description: 'The teams of this workspace they join on accepting.',
    example: ['team_1'],
    type: String,
    isArray: true,
  })
  readonly teamIds!: string[];
}
