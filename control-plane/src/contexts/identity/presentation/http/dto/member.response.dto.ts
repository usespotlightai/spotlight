import type { MemberDto } from '@identity/application/dto/member.dto';
import { TeamReferenceResponseDto } from '@identity/presentation/http/dto/team-reference.response.dto';
import { ApiProperty } from '@nestjs/swagger';

export class MemberResponseDto {
  @ApiProperty({ example: 'a17c4e02-9b3d-4f61-8e5a-0c2d7b9f4a13' })
  readonly id!: string;

  @ApiProperty({ example: 'Ada Lovelace' })
  readonly name!: string;

  @ApiProperty({ type: String, nullable: true })
  readonly image!: string | null;

  @ApiProperty({
    description: 'What they are in the workspace this team belongs to.',
    example: 'member',
    enum: ['owner', 'admin', 'member'],
  })
  readonly role!: MemberDto['role'];

  @ApiProperty({
    description:
      'The roles that the caller can assign to this member. The list is empty when the caller cannot change the role of this member. The workspace uses the same rule when it changes a role.',
    example: ['admin', 'member'],
    enum: ['owner', 'admin', 'member'],
    isArray: true,
  })
  readonly assignableRoles!: MemberDto['assignableRoles'];
}

export class WorkspaceMemberResponseDto extends MemberResponseDto {
  @ApiProperty({ example: 'ada@example.com' })
  readonly email!: string;

  @ApiProperty({
    description: 'The teams of this workspace they are on.',
    type: TeamReferenceResponseDto,
    isArray: true,
  })
  readonly teams!: readonly TeamReferenceResponseDto[];

  @ApiProperty({
    description: 'When they joined the workspace.',
    example: '2026-09-12T09:00:00.000Z',
  })
  readonly joinedAt!: string;
}
