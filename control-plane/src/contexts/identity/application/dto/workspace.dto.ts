import type { Provisioning } from '@identity/application/ports/workspace-provisioning.port';

interface TeamDto {
  readonly id: string;
  readonly name: string;
}

export interface WorkspaceDto {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly teams: readonly TeamDto[];
}

export interface WorkspaceDetailDto extends WorkspaceDto {
  readonly role: string;
  readonly provisioning: Provisioning;
}

export interface WorkspaceListingDto {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly role: string;
}
