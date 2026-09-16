import { ApiProperty } from '@nestjs/swagger';

export class CreateLabelRequestDto {
  @ApiProperty({ example: 'Bug' })
  readonly name!: string;

  @ApiProperty({ example: '#e11d48', description: 'Six digit hex colour' })
  readonly colour!: string;
}
