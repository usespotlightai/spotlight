import type {
  HocuspocusProvider,
  HocuspocusProviderWebsocket,
} from '@hocuspocus/provider';
import type { Provider } from '@lexical/yjs';
import type { Array as YArray, Doc, Map as YMap } from 'yjs';

import type { Person } from '@/lib/person';

const COLLAB_PATH = '/api/collab';

export const taskDraftName = (taskId: string): string => `task-draft:${taskId}`;

export type SharedAttachment = {
  readonly key: string;
  readonly id: string;
  readonly name: string;
  readonly size: number;
  readonly image: boolean;
};

export type DraftPerson = Person & { readonly color: string };

export type DraftParts = {
  readonly meta: YMap<number | string>;
  readonly writers: YMap<boolean>;
  readonly attachments: YArray<SharedAttachment>;
};

// The control plane reads and writes these same names.
export const draftParts = (doc: Doc): DraftParts => ({
  meta: doc.getMap<number | string>('meta'),
  writers: doc.getMap<boolean>('writers'),
  attachments: doc.getArray<SharedAttachment>('attachments'),
});

const COLORS = [
  '#2563eb',
  '#db2777',
  '#16a34a',
  '#d97706',
  '#7c3aed',
  '#0891b2',
  '#dc2626',
  '#4d7c0f',
];

export const colorOf = (id: string): string => {
  let hash = 0;

  for (const char of id) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  return COLORS[hash % COLORS.length] ?? COLORS[0];
};

export const collabUrl = (location: Location): string =>
  `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${COLLAB_PATH}`;

type ProviderListener =
  | readonly ['sync', (isSynced: boolean) => void]
  | readonly ['status', (arg0: { status: string }) => void]
  | readonly ['update', (arg0: unknown) => void]
  | readonly ['reload', (doc: Doc) => void];

// Lexical connects once its binding listens, so a draft that syncs fast never arrives before the editor can take it in.
export const lexicalProvider = (
  provider: HocuspocusProvider,
  socket: HocuspocusProviderWebsocket,
): Provider => {
  const synced = new Map<
    (isSynced: boolean) => void,
    (event: { state: boolean }) => void
  >();

  return {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    awareness: provider.awareness as unknown as Provider['awareness'],
    connect: () => {
      provider.attach();
      void socket.connect();
    },
    disconnect: () => provider.detach(),
    on: (...[type, cb]: ProviderListener) => {
      if (type === 'sync') {
        const forward = ({ state }: { state: boolean }) => cb(state);
        synced.set(cb, forward);
        provider.on('synced', forward);

        if (provider.isSynced) {
          queueMicrotask(() => cb(true));
        }
      } else if (type === 'status') {
        provider.on('status', cb);
      }
    },
    off: (...[type, cb]: ProviderListener) => {
      if (type === 'sync') {
        const forward = synced.get(cb);

        if (forward) {
          provider.off('synced', forward);
          synced.delete(cb);
        }
      } else if (type === 'status') {
        provider.off('status', cb);
      }
    },
  };
};
