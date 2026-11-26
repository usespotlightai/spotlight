import { ApiProperty } from '@nestjs/swagger';
import type { WorkspaceSecretDto } from '@secrets/application/dto/workspace-secret.dto';
import {
  SECRET_SANDBOXES,
  type SecretSandbox,
} from '@secrets/domain/value-objects/secret-sandbox.vo';
import {
  SECRET_VALUE_ORIGINS,
  type SecretValueOriginKind,
} from '@secrets/domain/value-objects/secret-value-origin.vo';
import { SECRET_SANDBOX } from '@secrets/presentation/http/dto/secret-resource.response.dto';

export class WorkspaceSecretResponseDto {
  @ApiProperty({ example: 'STAGING_LOGIN_PASSWORD' })
  readonly name: string;

  @ApiProperty({
    type: String,
    isArray: true,
    example: ['staging.example.com'],
    description: 'The hosts egress sends the value to',
  })
  readonly hosts: readonly string[];

  @ApiProperty({
    enum: SECRET_SANDBOXES,
    enumName: 'SecretSandbox',
    example: 'stand-in',
    description: SECRET_SANDBOX,
  })
  readonly sandbox: SecretSandbox;

  @ApiProperty({
    enum: SECRET_VALUE_ORIGINS,
    enumName: 'SecretValueOrigin',
    example: 'awaiting',
    description:
      'Where the value comes from: awaiting (no value yet; runs that need it fail), spotlight (stored, and Terraform does not set it), or terraform (value_wo_version sets it)',
  })
  readonly valueOrigin: SecretValueOriginKind;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'When Spotlight last stored a value; null when it holds none',
  })
  readonly valueSetAt: string | null;

  @ApiProperty({
    description:
      'True when you can set the value here: Spotlight stores it, Terraform does not set it, and you manage secrets',
  })
  readonly settable: boolean;

  @ApiProperty({
    description:
      'False when no runner pool of the workspace has egress, so egress never injects it at its hosts',
  })
  readonly reachesHosts: boolean;

  constructor(secret: WorkspaceSecretDto) {
    this.name = secret.name;
    this.hosts = secret.hosts;
    this.sandbox = secret.sandbox;
    this.valueOrigin = secret.valueOrigin;
    this.valueSetAt = secret.valueSetAt?.toISOString() ?? null;
    this.settable = secret.settable;
    this.reachesHosts = secret.reachesHosts;
  }
}
