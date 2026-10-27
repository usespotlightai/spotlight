import type { RequestHeaders } from '@shared-kernel/application/ports/session.port';
import type { Doc } from 'yjs';

export interface CollabDocuments {
  admit(id: string, headers: RequestHeaders): Promise<boolean>;

  load(id: string, doc: Doc): Promise<void>;

  keep(id: string, state: Uint8Array): Promise<void>;
}

export const documentName = (kind: string, id: string): string =>
  `${kind}:${id}`;
