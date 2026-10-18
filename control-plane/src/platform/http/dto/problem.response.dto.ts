import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FORBIDDEN_ACTS } from '@platform/http/resources/problem.exception';
import type { ForbiddenAct } from '@shared-kernel/application/dto/resource-outcomes.dto';

export class FieldErrorResponseDto {
  @ApiProperty({
    example: 'stations[2].check',
    description:
      'The attribute it is about, as a Terraform provider addresses one; empty for the whole resource',
  })
  readonly path!: string;

  @ApiProperty({ example: 'must not be empty' })
  readonly message!: string;

  @ApiProperty({ enum: ['error', 'warning'] })
  readonly severity!: 'error' | 'warning';
}

export class ProblemResponseDto {
  @ApiProperty({
    example: 'urn:spotlight:problem:version-conflict',
    description: 'What kind of problem it is; stable, safe to branch on',
  })
  readonly type!: string;

  @ApiProperty({ example: 'The integration changed since it was read' })
  readonly title!: string;

  @ApiProperty({ example: 409 })
  readonly status!: number;

  @ApiProperty({
    example:
      'The integration changed since you read it. Please send the current version as If-Match. Current version: 4',
  })
  readonly detail!: string;

  @ApiPropertyOptional({
    type: FieldErrorResponseDto,
    isArray: true,
    description: 'Each field that is wrong, when the request was invalid',
  })
  readonly errors?: readonly FieldErrorResponseDto[];

  @ApiPropertyOptional({
    example: 4,
    description: 'The version the resource is at now, when a write conflicted',
  })
  readonly currentVersion?: number;

  @ApiPropertyOptional({
    enum: FORBIDDEN_ACTS,
    example: 'secrets',
    description:
      'The permission the caller lacks, when the request is forbidden: one its role in the workspace, or its token’s scopes, do not grant',
  })
  readonly permission?: ForbiddenAct;
}
