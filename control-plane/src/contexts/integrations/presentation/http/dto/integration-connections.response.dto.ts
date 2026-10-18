import type {
  ConnectionToolRuleDto,
  IntegrationConnectionsDto,
  MyConnectionDto,
  OwnConnectionDto,
  PersonConnectionDto,
} from '@integrations/application/dto/integration-connections.dto';
import { PERSON_TOOL_RULES } from '@integrations/domain/value-objects/person-tool-rule.vo';
import { ApiProperty } from '@nestjs/swagger';

class OwnConnectionResponseDto {
  @ApiProperty({ example: 'linear' })
  readonly integration: string;

  @ApiProperty({
    description: 'The account name of the person on the service',
    example: '@alice',
    nullable: true,
    type: String,
  })
  readonly linkedAccount: string | null;

  @ApiProperty({ example: '2026-10-05T10:00:00.000Z' })
  readonly connectedAt: string;

  constructor(connection: OwnConnectionDto) {
    this.integration = connection.integration;
    this.linkedAccount = connection.linkedAccount;
    this.connectedAt = connection.connectedAt.toISOString();
  }
}

export class ConnectionToolRuleResponseDto {
  @ApiProperty({ example: 'linear.comment' })
  readonly tool: string;

  @ApiProperty({
    enum: PERSON_TOOL_RULES,
    example: 'needs-approval',
    description:
      'What the caller requires of calls made with their connection: allowed follows the team, needs-approval asks them first, blocked never sends',
  })
  readonly rule: string;

  constructor(rule: ConnectionToolRuleDto) {
    this.tool = rule.tool;
    this.rule = rule.rule;
  }
}

export class MyConnectionResponseDto extends OwnConnectionResponseDto {
  @ApiProperty({
    type: ConnectionToolRuleResponseDto,
    isArray: true,
    description:
      'Each tool the integration offers, with the caller’s rule for calls made with this connection',
  })
  readonly tools: readonly ConnectionToolRuleResponseDto[];

  constructor(connection: MyConnectionDto) {
    super(connection);
    this.tools = connection.tools.map(
      (each) => new ConnectionToolRuleResponseDto(each),
    );
  }
}

export class PersonConnectionResponseDto extends OwnConnectionResponseDto {
  @ApiProperty({ example: 'user_1' })
  readonly personId: string;

  @ApiProperty({ example: 'Alice Martin' })
  readonly name: string;

  constructor(connection: PersonConnectionDto) {
    super(connection);
    this.personId = connection.personId;
    this.name = connection.name;
  }
}

export class IntegrationConnectionsResponseDto {
  @ApiProperty({
    type: MyConnectionResponseDto,
    isArray: true,
    description: 'The connections the caller made themselves',
  })
  readonly mine: readonly MyConnectionResponseDto[];

  @ApiProperty({
    type: PersonConnectionResponseDto,
    isArray: true,
    nullable: true,
    description:
      'Who in the team has connected what, shown to admins only; it never contains a token',
  })
  readonly people: readonly PersonConnectionResponseDto[] | null;

  constructor(connections: IntegrationConnectionsDto) {
    this.mine = connections.mine.map(
      (each) => new MyConnectionResponseDto(each),
    );
    this.people =
      connections.people?.map(
        (each) => new PersonConnectionResponseDto(each),
      ) ?? null;
  }
}
