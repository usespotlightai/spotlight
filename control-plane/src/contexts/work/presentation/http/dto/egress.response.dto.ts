import { ApiProperty } from '@nestjs/swagger';
import { SECRET_CARRIERS } from '@shared-kernel/domain/value-objects/secret-carriers';

export class ReadInNetworkResponseDto {
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

export class RedeemedSecretResponseDto {
  @ApiProperty({ example: 'LINEAR_API_KEY' })
  readonly secret: string;

  @ApiProperty({
    example: 'mcp.linear.app',
    description: 'The one host egress wears it toward',
  })
  readonly host: string;

  @ApiProperty({
    enum: SECRET_CARRIERS,
    example: 'header',
    description:
      'Whether egress wears it in a request header or a query parameter',
  })
  readonly carrier: string;

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
    type: ReadInNetworkResponseDto,
    nullable: true,
    description:
      'Where egress reads the value with its host’s own identity; null when Spotlight sealed it',
  })
  readonly readInNetwork: ReadInNetworkResponseDto | null;

  constructor(
    secret: string,
    host: string,
    carrier: string,
    name: string,
    prefix: string,
    sealed: string | null,
    readInNetwork: ReadInNetworkResponseDto | null,
  ) {
    this.secret = secret;
    this.host = host;
    this.carrier = carrier;
    this.name = name;
    this.prefix = prefix;
    this.sealed = sealed;
    this.readInNetwork = readInNetwork;
  }
}

export class WithheldSecretResponseDto {
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
      'A read and plan token for this run alone, sealed to the recipient; egress wears it toward the control plane as a bearer token',
  })
  readonly sealed: string;

  constructor(sealed: string) {
    this.sealed = sealed;
  }
}

export class EgressRedemptionResponseDto {
  @ApiProperty({
    type: String,
    nullable: true,
    example: 'run_1',
    description:
      'The run the sealed values are bound to; null when the sandbox checks a change stack and wears nothing',
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

  @ApiProperty({ type: [RedeemedSecretResponseDto] })
  readonly secrets: readonly RedeemedSecretResponseDto[];

  @ApiProperty({
    type: [WithheldSecretResponseDto],
    description: 'Secrets the run wears that egress will not get, and why',
  })
  readonly withheld: readonly WithheldSecretResponseDto[];

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
    secrets: readonly RedeemedSecretResponseDto[],
    withheld: readonly WithheldSecretResponseDto[],
    spotlightApi: SpotlightApiResponseDto | null,
  ) {
    this.runId = runId;
    this.reaches = reaches;
    this.bound = bound;
    this.secrets = secrets;
    this.withheld = withheld;
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
