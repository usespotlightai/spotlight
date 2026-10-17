import { ApiProperty } from '@nestjs/swagger';
import { SECRET_LOCATIONS } from '@shared-kernel/domain/value-objects/secret-locations';

export class ExternalSecretRefResponseDto {
  @ApiProperty({ enum: ['aws-secrets-manager'] })
  readonly kind: 'aws-secrets-manager';

  @ApiProperty({
    example:
      'arn:aws:secretsmanager:eu-west-1:123456789012:secret:linear-api-key',
  })
  readonly secretId: string;

  @ApiProperty({ type: String, nullable: true, example: 'token' })
  readonly field: string | null;

  constructor(
    kind: 'aws-secrets-manager',
    secretId: string,
    field: string | null,
  ) {
    this.kind = kind;
    this.secretId = secretId;
    this.field = field;
  }
}

export class FetchedSecretResponseDto {
  @ApiProperty({ example: 'LINEAR_API_KEY' })
  readonly secret: string;

  @ApiProperty({
    example: 'mcp.linear.app',
    description: 'The one host that egress injects it for',
  })
  readonly host: string;

  @ApiProperty({
    enum: SECRET_LOCATIONS,
    example: 'header',
    description:
      'Whether egress injects it in a request header or in a query parameter',
  })
  readonly location: string;

  @ApiProperty({
    example: 'authorization',
    description: 'The header or query parameter that contains its stand-in',
  })
  readonly name: string;

  @ApiProperty({ example: 'Bearer ' })
  readonly prefix: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'The value, sealed to the recipient for this run; null when egress reads it in its own network',
  })
  readonly sealed: string | null;

  @ApiProperty({
    type: ExternalSecretRefResponseDto,
    nullable: true,
    description:
      'Where egress reads the value with its host’s own identity; null when Spotlight sealed it',
  })
  readonly externalRef: ExternalSecretRefResponseDto | null;

  constructor(
    secret: string,
    host: string,
    location: string,
    name: string,
    prefix: string,
    sealed: string | null,
    externalRef: ExternalSecretRefResponseDto | null,
  ) {
    this.secret = secret;
    this.host = host;
    this.location = location;
    this.name = name;
    this.prefix = prefix;
    this.sealed = sealed;
    this.externalRef = externalRef;
  }
}

export class DeniedSecretResponseDto {
  @ApiProperty({ example: 'LINEAR_API_KEY' })
  readonly secret: string;

  @ApiProperty({
    example:
      'The workspace has no secret named LINEAR_API_KEY; define it before anything uses it',
  })
  readonly reason: string;

  constructor(secret: string, reason: string) {
    this.secret = secret;
    this.reason = reason;
  }
}

export class SpotlightApiResponseDto {
  @ApiProperty({
    description:
      'A read and plan token for this run alone, sealed to the recipient; egress injects it for the control plane as a bearer token',
  })
  readonly sealed: string;

  constructor(sealed: string) {
    this.sealed = sealed;
  }
}

export class EgressSecretsResponseDto {
  @ApiProperty({
    type: String,
    nullable: true,
    example: 'run_1',
    description:
      'The run the sealed values are bound to; null when the sandbox checks a change stack and gets no secrets',
  })
  readonly runId: string | null;

  @ApiProperty({
    type: [String],
    example: ['storage.example.com'],
    description:
      'Hosts every sandbox must reach besides the control plane, whatever else the host allows',
  })
  readonly reaches: readonly string[];

  @ApiProperty({
    type: [String],
    example: ['mcp.linear.app'],
    description:
      'The hosts the secrets are bound to. Egress decrypts only these hosts, and also the control plane host when spotlightApi is set',
  })
  readonly bound: readonly string[];

  @ApiProperty({ type: [FetchedSecretResponseDto] })
  readonly secrets: readonly FetchedSecretResponseDto[];

  @ApiProperty({
    type: [DeniedSecretResponseDto],
    description: 'The secrets of the run that egress does not get, and why',
  })
  readonly denied: readonly DeniedSecretResponseDto[];

  @ApiProperty({
    type: SpotlightApiResponseDto,
    nullable: true,
    description:
      'Where the run reaches Spotlight’s own API, the token it reaches it with',
  })
  readonly spotlightApi: SpotlightApiResponseDto | null;

  constructor(
    runId: string | null,
    reaches: readonly string[],
    bound: readonly string[],
    secrets: readonly FetchedSecretResponseDto[],
    denied: readonly DeniedSecretResponseDto[],
    spotlightApi: SpotlightApiResponseDto | null,
  ) {
    this.runId = runId;
    this.reaches = reaches;
    this.bound = bound;
    this.secrets = secrets;
    this.denied = denied;
    this.spotlightApi = spotlightApi;
  }
}

export class EgressAdmissionResponseDto {
  @ApiProperty({ example: 'runner_1' })
  readonly runnerId: string;

  @ApiProperty({ example: 'ws_1' })
  readonly workspaceId: string;

  @ApiProperty({
    example: 'app.usespotlight.ai',
    description:
      'The host of the control plane URL the runner was handed. Before the runner has a run, egress lets it reach only this host',
  })
  readonly controlPlaneHost: string;

  @ApiProperty({
    example: 443,
    description:
      'The port of the control plane URL the runner was handed. Egress lets a sandbox reach the control plane host only on this port',
  })
  readonly controlPlanePort: number;

  @ApiProperty({
    type: [String],
    example: ['storage.example.com'],
    description:
      'Hosts every sandbox must reach besides the control plane, whatever else the egress allows',
  })
  readonly reaches: readonly string[];

  constructor(
    runnerId: string,
    workspaceId: string,
    controlPlaneHost: string,
    controlPlanePort: number,
    reaches: readonly string[],
  ) {
    this.runnerId = runnerId;
    this.workspaceId = workspaceId;
    this.controlPlaneHost = controlPlaneHost;
    this.controlPlanePort = controlPlanePort;
    this.reaches = reaches;
  }
}

export class EgressActiveRunsResponseDto {
  @ApiProperty({
    type: [String],
    description:
      'The proxy credentials whose runner still leases its work, or has no work yet. Egress forgets every other run',
  })
  readonly active: readonly string[];

  constructor(active: readonly string[]) {
    this.active = active;
  }
}
