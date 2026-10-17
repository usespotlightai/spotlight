import {
  MEMORY_KIND_NAMES,
  MEMORY_REACH_NAMES,
} from '@memory/application/dto/memory-review.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RememberRequestDto {
  @ApiProperty({ enum: MEMORY_KIND_NAMES, example: 'rationale' })
  readonly kind!: string;

  @ApiProperty({ example: 'Uploads retry in the request, not from a queue.' })
  readonly body!: string;

  @ApiPropertyOptional({
    enum: MEMORY_REACH_NAMES,
    nullable: true,
    description: 'Where it applies; the run’s line when left out',
  })
  readonly reach?: string | null;

  @ApiPropertyOptional({
    type: String,
    isArray: true,
    example: ['api/src/uploads'],
    description:
      'Paths it bears on, relative to the run’s workspace, each starting with the checkout folder',
  })
  readonly paths?: readonly string[];

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    example: 'M-7',
    description: 'The active memory it corrects, by handle',
  })
  readonly supersedes?: string | null;
}

export class RecallMemoriesRequestDto {
  @ApiProperty({ example: 'upload retries', description: 'Words to look for' })
  readonly words!: string;
}
