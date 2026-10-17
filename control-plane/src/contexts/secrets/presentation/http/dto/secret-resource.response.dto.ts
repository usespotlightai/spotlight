import { ApiProperty } from '@nestjs/swagger';
import { ResourceResponseDto } from '@platform/http/dto/resource.response.dto';
import type { SecretResourceDto } from '@secrets/application/dto/secret-resource.dto';
import {
  SECRET_SOURCE_KINDS,
  type SecretSourceKind,
} from '@secrets/domain/value-objects/secret-source.vo';
import { SECRET_LOCATIONS } from '@shared-kernel/domain/value-objects/secret-locations';

class SecretSourceResponseDto {
  @ApiProperty({
    enum: SECRET_SOURCE_KINDS,
    example: 'built-in',
    description:
      'Where the value lives: kept by Spotlight, or read from AWS Secrets Manager when it is used',
  })
  readonly kind: SecretSourceKind;

  @ApiProperty({
    type: String,
    nullable: true,
    example: null,
    description: 'The name or ARN of the secret in AWS Secrets Manager',
  })
  readonly secretId: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: null,
    description: 'The key to read when that secret contains JSON',
  })
  readonly field: string | null;

  constructor(source: SecretResourceDto['source']) {
    this.kind = source.kind;
    this.secretId = source.secretId;
    this.field = source.field;
  }
}

class SecretBindingResponseDto {
  @ApiProperty({
    example: 'api.linear.app',
    description: 'A host the secret may be sent to, over HTTPS only',
  })
  readonly host: string;

  @ApiProperty({
    enum: SECRET_LOCATIONS,
    example: 'header',
    description:
      'Whether Spotlight injects it in a request header or in a query parameter',
  })
  readonly location: string;

  @ApiProperty({
    example: 'authorization',
    description: 'The header or query parameter that Spotlight injects it in',
  })
  readonly name: string;

  @ApiProperty({
    example: 'Bearer ',
    description: 'The text that Spotlight writes before the value',
  })
  readonly prefix: string;

  constructor(binding: SecretResourceDto['bindings'][number]) {
    this.host = binding.host;
    this.location = binding.location;
    this.name = binding.name;
    this.prefix = binding.prefix;
  }
}

export class SecretResourceResponseDto extends ResourceResponseDto {
  @ApiProperty({
    example: '5b1e9d2c-7a43-4f8e-b6c0-3d9a8e1f2b57',
    description: 'The workspace it belongs to',
  })
  readonly workspaceId: string;

  @ApiProperty({
    example: 'LINEAR_API_KEY',
    description:
      'What integrations call it; fixed for its life, so changing it means replacing the secret',
  })
  readonly name: string;

  @ApiProperty({ type: SecretSourceResponseDto })
  readonly source: SecretSourceResponseDto;

  @ApiProperty({
    type: SecretBindingResponseDto,
    isArray: true,
    description:
      'The only hosts the secret is ever sent to, and how; a request anywhere else goes without it',
  })
  readonly bindings: readonly SecretBindingResponseDto[];

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 1,
    description:
      'Changing it rotates the value to the valueWo sent with it; the value itself is write-only and never answered',
  })
  readonly valueWoVersion: number | null;

  @ApiProperty({
    example: '2026-09-23T12:00:00.000Z',
    description: 'When the value was last set; not settable',
  })
  readonly rotatedAt: string;

  constructor(secret: SecretResourceDto) {
    super(secret);
    this.workspaceId = secret.workspaceId;
    this.name = secret.name;
    this.source = new SecretSourceResponseDto(secret.source);
    this.bindings = secret.bindings.map(
      (each) => new SecretBindingResponseDto(each),
    );
    this.valueWoVersion = secret.valueWoVersion;
    this.rotatedAt = secret.rotatedAt;
  }
}
