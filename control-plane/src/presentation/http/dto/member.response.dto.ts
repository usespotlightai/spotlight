import { ApiProperty } from '@nestjs/swagger';

export class MemberResponseDto {
  @ApiProperty({ example: 'a17c4e02-9b3d-4f61-8e5a-0c2d7b9f4a13' })
  readonly id!: string;

  @ApiProperty({ example: 'Ada Lovelace' })
  readonly name!: string;

  @ApiProperty({ type: String, nullable: true })
  readonly image!: string | null;
}
