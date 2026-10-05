export interface OwnConnectionDto {
  readonly source: string;
  readonly handle: string | null;
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

export interface HostConnectionsDto {
  readonly mine: readonly MyConnectionDto[];
  readonly people: readonly PersonConnectionDto[] | null;
}
