export interface OwnConnectionDto {
  readonly integration: string;
  readonly linkedAccount: string | null;
  readonly connectedAt: Date;
}

export interface ConnectionToolRuleDto {
  readonly tool: string;
  readonly rule: string;
}

export interface MyConnectionDto extends OwnConnectionDto {
  readonly tools: readonly ConnectionToolRuleDto[];
}

export interface PersonConnectionDto extends OwnConnectionDto {
  readonly personId: string;
  readonly name: string;
}

export interface IntegrationConnectionsDto {
  readonly mine: readonly MyConnectionDto[];
  readonly people: readonly PersonConnectionDto[] | null;
}
