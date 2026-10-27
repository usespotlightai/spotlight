import type {
  HocuspocusProvider,
  HocuspocusProviderWebsocket,
} from '@hocuspocus/provider';
import type { Provider } from '@lexical/yjs';
import type { Doc } from 'yjs';
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

// The control plane reads and writes these same names.
export const draftParts = (doc: Doc) => ({
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
    awareness: provider.awareness as unknown as Provider['awareness'],
    connect: () => {
      provider.attach();
      void socket.connect();
    },
    disconnect: () => provider.detach(),
    on: ((type: string, cb: (value: never) => void) => {
      if (type === 'sync') {
        const forward = ({ state }: { state: boolean }) =>
          (cb as (isSynced: boolean) => void)(state);
        synced.set(cb as (isSynced: boolean) => void, forward);
        provider.on('synced', forward);

        if (provider.isSynced) {
          queueMicrotask(() => (cb as (isSynced: boolean) => void)(true));
        }
      } else if (type === 'status') {
        provider.on('status', cb);
      }
    }) as Provider['on'],
    off: ((type: string, cb: (value: never) => void) => {
      if (type === 'sync') {
        const forward = synced.get(cb as (isSynced: boolean) => void);

        if (forward) {
          provider.off('synced', forward);
          synced.delete(cb as (isSynced: boolean) => void);
        }
      } else if (type === 'status') {
        provider.off('status', cb);
      }
    }) as Provider['off'],
  };
};
