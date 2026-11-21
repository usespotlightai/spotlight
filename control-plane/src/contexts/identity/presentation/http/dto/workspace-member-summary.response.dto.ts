import type { WorkspaceMemberSummaryDto } from '@identity/application/dto/member.dto';
import { WORKSPACE_ROLES } from '@identity/domain/value-objects/workspace-role.vo';
import { ApiProperty } from '@nestjs/swagger';

export class WorkspaceMemberSummaryResponseDto {
  @ApiProperty({ example: 'a17c4e02-9b3d-4f61-8e5a-0c2d7b9f4a13' })
  readonly id: string;

  @ApiProperty({ example: 'ada@example.com' })
  readonly email: string;

  @ApiProperty({ example: 'Ada Lovelace' })
  readonly name: string;

  @ApiProperty({
    description: 'What they are in the workspace',
    example: 'member',
    enum: WORKSPACE_ROLES,
  })
  readonly role: WorkspaceMemberSummaryDto['role'];

  @ApiProperty({
    description: 'When they joined the workspace',
    example: '2026-09-12T09:00:00.000Z',
  })
  readonly joinedAt: string;

  constructor(member: WorkspaceMemberSummaryDto) {
    this.id = member.id;
    this.email = member.email;
    this.name = member.name;
    this.role = member.role;
    this.joinedAt = member.joinedAt;
  }
}
