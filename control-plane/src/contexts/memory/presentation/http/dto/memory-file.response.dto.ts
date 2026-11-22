import type {
  MemoryFileDto,
  MemoryFileRepositoryDto,
} from '@memory/application/dto/memory-file.dto';
import { ApiProperty } from '@nestjs/swagger';

export class MemoryFileRepositoryResponseDto {
  @ApiProperty({ example: 'acme' })
  readonly owner: string;

  @ApiProperty({ example: 'api' })
  readonly name: string;

  constructor(repository: MemoryFileRepositoryDto) {
    this.owner = repository.owner;
    this.name = repository.name;
  }
}

export class MemoryFileResponseDto {
  @ApiProperty({
    example: '.spotlight/memory/repositories/acme/api/src/uploads/M-18.md',
    description: 'Where to write it, relative to the run’s working copy',
  })
  readonly path: string;

  @ApiProperty({
    example: '# M-18 · rationale\n\nUploads retry in the request.\n',
  })
  readonly body: string;

  @ApiProperty({ example: 'M-18' })
  readonly handle: string;

  @ApiProperty({
    type: MemoryFileRepositoryResponseDto,
    nullable: true,
    description: 'The repository the memory is about, if it is about one',
  })
  readonly repository: MemoryFileRepositoryResponseDto | null;

  @ApiProperty({
    type: [String],
    example: ['src/uploads'],
    description: 'Paths in the repository the memory is about',
  })
  readonly paths: string[];

  @ApiProperty({
    description:
      'Whether the run’s briefing already lists the memory, so touching one of its paths need not show it again',
  })
  readonly briefed: boolean;

  @ApiProperty({
    description:
      'Whether it was learned at another line or station about one of the run’s repositories, so it is laid out for reference and never shown for a path the agent used',
  })
  readonly elsewhere: boolean;

  constructor(file: MemoryFileDto) {
    this.path = file.path;
    this.body = file.body;
    this.handle = file.handle;
    this.repository = file.repository
      ? new MemoryFileRepositoryResponseDto(file.repository)
      : null;
    this.paths = [...file.paths];
    this.briefed = file.briefed;
    this.elsewhere = file.elsewhere;
  }
}
