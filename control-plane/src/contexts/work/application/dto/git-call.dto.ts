export const GIT_SERVICES = ['git-upload-pack', 'git-receive-pack'] as const;

export type GitService = (typeof GIT_SERVICES)[number];

export interface GitCallDto {
  readonly method: 'GET' | 'POST';
  readonly path: string;
  readonly search: string;
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
  readonly body: AsyncIterable<Uint8Array> | null;
}

export interface GitAnswerDto {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: AsyncIterable<Uint8Array> | null;
}
