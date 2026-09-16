import { ApiProperty } from '@nestjs/swagger';

export class RenameLabelRequestDto {
  @ApiProperty({ example: 'Feature' })
  readonly name!: string;
}
