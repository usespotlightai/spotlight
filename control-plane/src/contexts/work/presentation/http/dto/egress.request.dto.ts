import { ApiProperty } from '@nestjs/swagger';
import {
  CONNECTION_OUTCOMES,
  CONNECTION_REASONS,
} from '@work/domain/value-objects/run-connection.vo';

class RedeemEgressRequestDto {
  @ApiProperty({
    example: 'p8kX0q1cVJ3Q0x4yQ2a6m0dD6b8hT3n1gC9sZ7rW2Ek=',
    description:
      'The X25519 public key that egress keeps for this run alone, in base64; values Spotlight keeps are sealed to it',
  })
  readonly recipient!: string;
}

export class SharedRedeemEgressRequestDto extends RedeemEgressRequestDto {
  @ApiProperty({
    required: false,
    description:
      'The run proxy credential a runner presented to a shared egress. A shared egress sends it with its own egress token; the egress beside a sandbox leaves it out',
  })
  readonly proxyCredential?: string;
}

export class AdmitThroughEgressRequestDto {
  @ApiProperty({
    description: 'The run proxy credential a runner presented to the egress',
  })
  readonly proxyCredential!: string;
}

export class CheckActiveRunsRequestDto {
  @ApiProperty({
    type: [String],
    maxItems: 500,
    description: 'The run proxy credentials whose runs the egress serves now',
  })
  readonly proxyCredentials!: readonly string[];
}

export class EgressConnectionRequestDto {
  @ApiProperty() readonly proxyCredential!: string;

  @ApiProperty({ example: 'registry.npmjs.org' })
  readonly host!: string;

  @ApiProperty({ example: 443 })
  readonly port!: number;

  @ApiProperty({ description: 'Bytes from the sandbox to the host' })
  readonly bytesOut!: number;

  @ApiProperty({ description: 'Bytes from the host to the sandbox' })
  readonly bytesIn!: number;

  @ApiProperty({ description: 'How long the connection was open' })
  readonly ms!: number;

  @ApiProperty({ enum: CONNECTION_OUTCOMES })
  readonly outcome!: string;

  @ApiProperty({
    required: false,
    minimum: 100,
    maximum: 599,
    description:
      'The status the host answered a forwarded request with. Egress cannot read the status of a tunnel',
  })
  readonly status?: number;

  @ApiProperty({
    required: false,
    enum: CONNECTION_REASONS,
    description:
      'Why egress blocked the connection or could not open it. Spotlight drops a record whose reason does not fit its outcome',
  })
  readonly reason?: string;

  @ApiProperty({ format: 'date-time' })
  readonly at!: string;
}

export class RecordEgressConnectionsRequestDto {
  @ApiProperty({ type: [EgressConnectionRequestDto], maxItems: 2000 })
  readonly records!: readonly EgressConnectionRequestDto[];
}
