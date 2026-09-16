import { ApiProperty } from '@nestjs/swagger';

export class RecolourLabelRequestDto {
  @ApiProperty({ example: '#7c3aed', description: 'Six digit hex colour' })
  readonly colour!: string;
}
