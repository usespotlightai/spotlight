import { ApiProperty } from '@nestjs/swagger';

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

  @ApiProperty({ example: 'authorization' })
  readonly header: string;

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
    header: string,
    prefix: string,
    sealed: string | null,
    readInNetwork: ReadInNetworkResponseDto | null,
  ) {
    this.secret = secret;
    this.host = host;
    this.header = header;
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
      'The workspace holds no secret named LINEAR_API_KEY; define it before anything uses it',
  })
  readonly reason: string;

  constructor(secret: string, reason: string) {
    this.secret = secret;
    this.reason = reason;
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

  @ApiProperty({ type: [RedeemedSecretResponseDto] })
  readonly secrets: readonly RedeemedSecretResponseDto[];

  @ApiProperty({
    type: [WithheldSecretResponseDto],
    description: 'Secrets the run wears that egress will not get, and why',
  })
  readonly withheld: readonly WithheldSecretResponseDto[];

  constructor(
    runId: string | null,
    reaches: readonly string[],
    secrets: readonly RedeemedSecretResponseDto[],
    withheld: readonly WithheldSecretResponseDto[],
  ) {
    this.runId = runId;
    this.reaches = reaches;
    this.secrets = secrets;
    this.withheld = withheld;
  }
}
