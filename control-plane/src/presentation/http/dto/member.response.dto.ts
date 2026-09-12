import type { MemberDto } from '@application/dto/member.dto';
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
      'What the caller may set them to, which is empty where that is not theirs to do. Worked out by the same rule the workspace enforces.',
    example: ['admin', 'member'],
    enum: ['owner', 'admin', 'member'],
    isArray: true,
  })
  readonly mayBeSetTo!: MemberDto['mayBeSetTo'];
}
