import type {
  ChangedBy,
  ConfigurationChangeDto,
} from '@identity/application/dto/configuration-change.dto';
import { ApiProperty } from '@nestjs/swagger';
import {
  CONFIGURED_RESOURCES,
  type RecordedDetail,
} from '@shared-kernel/domain/value-objects/configuration-change.vo';

export class ChangedByResponseDto {
  @ApiProperty({
    enum: ['person', 'token', 'spotlight'],
    description:
      'A person signed in, a workspace token, or Spotlight itself following on from another change',
  })
  readonly kind: ChangedBy['kind'];

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'The person, or for a token the person who issued it',
  })
  readonly userId: string | null;

  @ApiProperty({ type: String, nullable: true })
  readonly tokenId: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'For a token issued by a workspace token trust, that trust; the person is then whoever created the trust',
  })
  readonly trust: string | null;

  constructor(by: ChangedBy) {
    this.kind = by.kind;
    this.userId = by.kind === 'spotlight' ? null : by.userId;
    this.tokenId = by.kind === 'token' ? by.tokenId : null;
    this.trust = by.kind === 'token' ? by.trust : null;
  }
}

export class ConfigurationChangeResponseDto {
  @ApiProperty({
    example: 42,
    description: 'Rises with every change; pass it as before to page back',
  })
  readonly seq: number;

  @ApiProperty({ enum: CONFIGURED_RESOURCES })
  readonly resource: string;

  @ApiProperty() readonly resourceId: string;

  @ApiProperty({
    example: 'delivery',
    description: 'The key it had within its team or workspace',
  })
  readonly key: string;

  @ApiProperty({ enum: ['created', 'updated', 'deleted'] })
  readonly action: string;

  @ApiProperty({ type: ChangedByResponseDto })
  readonly by: ChangedByResponseDto;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'terraform-provider/0.1.0',
    description:
      'What the change was made through, as it named itself in Spotlight-Client; unknown when it did not',
  })
  readonly client: string | null;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: { valueVersion: 2, targets: ['api.linear.app'] },
    description:
      'What moved beyond the action itself, where that is worth recording, as the resource’s kind records it; a secret records the value version it moved to and the hosts it is bound to once changed, never the value',
  })
  readonly details: RecordedDetail;

  @ApiProperty() readonly at: string;

  constructor(change: ConfigurationChangeDto) {
    this.seq = change.seq;
    this.resource = change.resource;
    this.resourceId = change.resourceId;
    this.key = change.key;
    this.action = change.action;
    this.by = new ChangedByResponseDto(change.by);
    this.client = change.client;
    this.details = change.details;
    this.at = change.at.toISOString();
  }
}
