import type { MemberDto } from '@identity/application/dto/member.dto';
import { ApiProperty } from '@nestjs/swagger';

export class ChangeMemberRoleRequestDto {
  @ApiProperty({
    description:
      'What they are to be in this workspace, which is what they may do in every team of it.',
    example: 'admin',
    enum: ['owner', 'admin', 'member'],
  })
  readonly role!: MemberDto['role'];
}

export class AddTeamMemberRequestDto {
  @ApiProperty({
    description: 'Somebody already in the workspace this team belongs to.',
    example: 'a17c4e02-9b3d-4f61-8e5a-0c2d7b9f4a13',
  })
  readonly userId!: string;
}
