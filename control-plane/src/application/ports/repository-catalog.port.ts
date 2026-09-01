export interface RepositorySummary {
  readonly fullName: string;
}

export const REPOSITORY_CATALOG = Symbol('REPOSITORY_CATALOG');

export interface RepositoryCatalogPort {
  list(): Promise<RepositorySummary[]>;
}
