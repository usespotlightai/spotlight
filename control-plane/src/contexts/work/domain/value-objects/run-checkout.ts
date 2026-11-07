export interface RunCheckout {
  readonly remote: string;
  readonly path?: string;
  readonly branch?: string;
  readonly ref?: string;
  readonly diffOf?: 'commits';
  readonly setup?: string;
}

export const REMOTE_VIA_GIT_PROXY = 'spotlight:repository';
