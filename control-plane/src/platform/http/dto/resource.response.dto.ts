import { ApiProperty } from '@nestjs/swagger';
import { FieldErrorResponseDto } from '@platform/http/dto/problem.response.dto';
import { fieldErrorOf } from '@platform/http/resources/problem.exception';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

export interface ResourceIdentity {
  readonly id: string;
  readonly version: number;
  readonly address: string;
  readonly warnings: readonly ConfigurationProblem[];
}

export abstract class ResourceResponseDto {
  @ApiProperty({
    example: '0d6f3c1e-8a52-4f7b-9c1d-5e2a7b3f9c40',
    description:
      'Issued by Spotlight when the resource is created, and never changed',
  })
  readonly id: string;

  @ApiProperty({
    example: 3,
    description:
      'Rises with every change; the ETag carries it, and a write sends it back as If-Match',
  })
  readonly version: number;

  @ApiProperty({
    example: 'core/linear',
    description:
      'Names the resource within its workspace; terraform import takes it',
  })
  readonly address: string;

  @ApiProperty({
    type: FieldErrorResponseDto,
    isArray: true,
    description:
      'What would work better, though nothing stops it working; not settable',
  })
  readonly warnings: readonly FieldErrorResponseDto[];

  protected constructor(identity: ResourceIdentity) {
    this.id = identity.id;
    this.version = identity.version;
    this.address = identity.address;
    this.warnings = identity.warnings.map(fieldErrorOf);
  }
}
