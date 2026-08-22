export interface TeamDto {
  readonly id: string;
  readonly name: string;
}

export interface WorkspaceDto {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly teams: readonly TeamDto[];
}

export interface WorkspaceListingDto {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly role: string;
}
