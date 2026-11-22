export interface MemoryFileRepositoryDto {
  readonly owner: string;
  readonly name: string;
}

export interface MemoryFileDto {
  readonly path: string;
  readonly body: string;
  readonly handle: string;
  readonly repository: MemoryFileRepositoryDto | null;
  readonly paths: readonly string[];
  readonly briefed: boolean;
  readonly elsewhere: boolean;
}
