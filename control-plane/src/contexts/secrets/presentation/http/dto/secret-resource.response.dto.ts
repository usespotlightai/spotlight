import { ApiProperty } from '@nestjs/swagger';
import { ResourceResponseDto } from '@platform/http/dto/resource.response.dto';
import type { SecretResourceDto } from '@secrets/application/dto/secret-resource.dto';
import { SECRET_LOCATIONS } from '@secrets/domain/value-objects/secret-location.vo';
import {
  SECRET_SANDBOXES,
  type SecretSandbox,
  SANDBOX_VALUE_MIN_LENGTH,
} from '@secrets/domain/value-objects/secret-sandbox.vo';

export const SECRET_SANDBOX = `Whether a run can get the value itself: stand-in (the default) keeps the value out of every sandbox, and egress puts it only in requests to the bound hosts; env lets a harness profile give the value to its runs as an environment variable, where the agent and every process in the sandbox can read it. With env, the value must have at least ${SANDBOX_VALUE_MIN_LENGTH} characters that are not whitespace and no NUL byte, and the secret cannot go back to stand-in while a harness profile names it in env`;

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
      'What integrations call it. Immutable: changing it means replacing the secret',
  })
  readonly name: string;

  @ApiProperty({
    type: SecretBindingResponseDto,
    isArray: true,
    description:
      'The only hosts the secret is ever sent to, and how; a request anywhere else goes without it',
  })
  readonly bindings: readonly SecretBindingResponseDto[];

  @ApiProperty({
    enum: SECRET_SANDBOXES,
    enumName: 'SecretSandbox',
    example: 'stand-in',
    description: SECRET_SANDBOX,
  })
  readonly sandbox: SecretSandbox;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 1,
    description:
      'Changing it rotates the value to the valueWo sent with it; the value itself is write-only and never returned',
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
    this.bindings = secret.bindings.map(
      (each) => new SecretBindingResponseDto(each),
    );
    this.sandbox = secret.sandbox;
    this.valueWoVersion = secret.valueWoVersion;
    this.rotatedAt = secret.rotatedAt;
  }
}
