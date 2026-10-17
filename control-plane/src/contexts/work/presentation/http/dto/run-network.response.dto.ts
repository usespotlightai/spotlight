import { ApiProperty } from '@nestjs/swagger';
import type { RunNetworkDto } from '@work/application/dto/run-network.dto';
import {
  CONNECTION_ERRORS,
  CONNECTION_OUTCOMES,
  CONNECTION_REASONS,
} from '@work/domain/value-objects/run-connection.vo';

export class RunConnectionResponseDto {
  @ApiProperty({ example: 'registry.npmjs.org' })
  readonly host: string;

  @ApiProperty({ example: 443 })
  readonly port: number;

  @ApiProperty({ description: 'Bytes from the sandbox to the host' })
  readonly bytesOut: number;

  @ApiProperty({ description: 'Bytes from the host to the sandbox' })
  readonly bytesIn: number;

  @ApiProperty({ description: 'How long the connection was open' })
  readonly ms: number;

  @ApiProperty({
    enum: CONNECTION_OUTCOMES,
    description:
      'passthrough: egress did not decrypt it. injected: egress decrypted it to inject a secret. blocked: egress stopped it. failed: egress could not open it',
  })
  readonly outcome: string;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 401,
    description:
      'The status the host answered an injected request with. null for a passthrough connection, because egress cannot read it',
  })
  readonly status: number | null;

  @ApiProperty({
    enum: [...CONNECTION_REASONS, null],
    nullable: true,
    description: 'Why egress blocked the connection or could not open it',
  })
  readonly reason: string | null;

  @ApiProperty({
    enum: [...CONNECTION_ERRORS, null],
    nullable: true,
    description:
      'The error of the connection. blocked: egress stopped it. failed: egress could not open it. auth-failed: the host answered an injected request with 401 or 403. server-error: the host answered it with 500 or more. null: no error',
  })
  readonly error: string | null;

  @ApiProperty({ format: 'date-time' })
  readonly at: string;

  constructor(connection: RunNetworkDto['connections'][number]) {
    this.host = connection.host;
    this.port = connection.port;
    this.bytesOut = connection.bytesOut;
    this.bytesIn = connection.bytesIn;
    this.ms = connection.ms;
    this.outcome = connection.outcome;
    this.status = connection.status;
    this.reason = connection.reason;
    this.error = connection.error;
    this.at = connection.at;
  }
}

export class RunNetworkResponseDto {
  @ApiProperty({ example: 'run_1' })
  readonly runId: string;

  @ApiProperty({ example: 1 })
  readonly attempt: number;

  @ApiProperty({
    enum: ['enforced', 'not-enforced', null],
    nullable: true,
    description:
      'What the runner in the sandbox reported before the harness started. enforced: a direct connection around egress failed. not-enforced: it operated. null: the runner did not check, for example on a host. The sandbox itself makes this report, so a compromised sandbox can report enforced',
  })
  readonly egressEnforcement: 'enforced' | 'not-enforced' | null;

  @ApiProperty({
    type: [RunConnectionResponseDto],
    description: 'The connections a shared egress recorded for this attempt',
  })
  readonly connections: readonly RunConnectionResponseDto[];

  constructor(network: RunNetworkDto) {
    this.runId = network.runId;
    this.attempt = network.attempt;
    this.egressEnforcement = network.egressEnforcement;
    this.connections = network.connections.map(
      (each) => new RunConnectionResponseDto(each),
    );
  }
}
