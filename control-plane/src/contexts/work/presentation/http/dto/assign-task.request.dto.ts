import { ApiProperty } from '@nestjs/swagger';

export class AssignTaskRequestDto {
  @ApiProperty({
    example: 'a17c4e02-9b3d-4f61-8e5a-0c2d7b9f4a13',
    nullable: true,
    type: String,
    description: 'The team member to give it to, or null to leave it unclaimed',
  })
  readonly assigneeId!: string | null;
}
