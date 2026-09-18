export interface Journalled {
  readonly type: string;
  readonly at: Date;
  readonly message: string | null;
  readonly data: string | null;
}

export const decoded = (data: string): string =>
  Buffer.from(data, 'base64').toString('utf8');
