export interface OwnConnectionDto {
  readonly source: string;
  readonly handle: string | null;
  readonly connectedAt: Date;
}

export interface PersonConnectionDto extends OwnConnectionDto {
  readonly personId: string;
  readonly name: string;
}

export interface HostConnectionsDto {
  readonly mine: readonly OwnConnectionDto[];
  readonly people: readonly PersonConnectionDto[] | null;
}
