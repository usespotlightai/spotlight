import type { MemoryFileDto } from '@memory/application/dto/memory-file.dto';
import { ApiProperty } from '@nestjs/swagger';

export class MemoryFileResponseDto {
  @ApiProperty({
    example: '.spotlight/memory/repositories/acme/api/src/uploads/M-18.md',
    description: 'Where to write it, relative to the run’s workspace',
  })
  readonly path: string;

  @ApiProperty({
    example: '# M-18 · rationale\n\nUploads retry in the request.\n',
  })
  readonly body: string;

  constructor(file: MemoryFileDto) {
    this.path = file.path;
    this.body = file.body;
  }
}
