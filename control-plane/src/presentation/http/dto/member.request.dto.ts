import type { MemberDto } from '@application/dto/member.dto';
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
