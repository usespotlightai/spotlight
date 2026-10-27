import {
  HocuspocusProvider,
  HocuspocusProviderWebsocket,
} from '@hocuspocus/provider';
import type { Provider } from '@lexical/yjs';
import { useEffect, useMemo, useState } from 'react';
import { Doc } from 'yjs';
import { useMe } from '@/hooks/useMe';
import {
  collabUrl,
  colorOf,
  type DraftPerson,
  draftParts,
  lexicalProvider,
  peopleIn,
  type SharedAttachment,
  taskDraftName,
} from '@/lib/shared-draft';

export type SharedDraft = {
  readonly name: string;
  readonly doc: Doc;
  readonly provider: Provider;
  readonly me: DraftPerson;
  readonly others: readonly DraftPerson[];
  readonly online: boolean;
  readonly synced: boolean;
  readonly generation: number;
  readonly sentText: string;
  readonly attachments: readonly SharedAttachment[];
  readonly coAuthors: () => string[];
  readonly wrote: () => void;
  readonly share: (attachment: SharedAttachment) => void;
  readonly unshare: (key: string) => void;
};

type Live = {
  readonly others: readonly DraftPerson[];
  readonly online: boolean;
  readonly synced: boolean;
  readonly generation: number;
  readonly sentText: string;
  readonly attachments: readonly SharedAttachment[];
};

type Connection = {
  readonly name: string;
  readonly doc: Doc;
  readonly provider: Provider;
  readonly me: DraftPerson;
};

const OFFLINE: Live = {
  others: [],
  online: true,
  synced: false,
  generation: 0,
  sentText: '',
  attachments: [],
};

export function useSharedDraft(taskId: string | undefined): SharedDraft | null {
  const me = useMe();
  const [connection, setConnection] = useState<Connection | null>(null);
  const [live, setLive] = useState<Live>(OFFLINE);
  const id = me?.id;
  const name = me?.name;
  const image = me?.image ?? null;

  useEffect(() => {
    if (!taskId || !id || name === undefined) {
      return;
    }

    const doc = new Doc();
    const documentName = taskDraftName(taskId);
    const socket = new HocuspocusProviderWebsocket({
      url: collabUrl(window.location),
      autoConnect: false,
    });
    const provider = new HocuspocusProvider({
      websocketProvider: socket,
      name: documentName,
      document: doc,
      token: 'session',
    });
    const person: DraftPerson = { id, name, image, color: colorOf(id) };
    const { meta, attachments } = draftParts(doc);
    const awareness = provider.awareness;

    awareness?.setLocalStateField('awarenessData', { person });

    const showPeople = () =>
      setLive((shown) => ({
        ...shown,
        others: awareness
          ? peopleIn(
              awareness.getStates() as Map<number, Record<string, unknown>>,
            ).filter((each) => each.id !== id)
          : [],
      }));
    const showStatus = ({ status }: { status: string }) =>
      setLive((shown) => ({ ...shown, online: status !== 'disconnected' }));
    const showSynced = ({ state }: { state: boolean }) =>
      setLive((shown) => ({ ...shown, synced: state }));
    const showGeneration = () => {
      const generation = meta.get('generation');
      const sent = meta.get('sent');

      setLive((shown) => ({
        ...shown,
        generation: typeof generation === 'number' ? generation : 0,
        sentText: typeof sent === 'string' ? sent : '',
      }));
    };
    const showAttachments = () =>
      setLive((shown) => ({ ...shown, attachments: attachments.toArray() }));

    awareness?.on('change', showPeople);
    provider.on('status', showStatus);
    provider.on('synced', showSynced);
    meta.observe(showGeneration);
    attachments.observe(showAttachments);

    setConnection({
      name: documentName,
      doc,
      provider: lexicalProvider(provider, socket),
      me: person,
    });

    return () => {
      awareness?.off('change', showPeople);
      provider.off('status', showStatus);
      provider.off('synced', showSynced);
      meta.unobserve(showGeneration);
      attachments.unobserve(showAttachments);
      provider.destroy();
      socket.destroy();
      doc.destroy();
      setConnection(null);
      setLive(OFFLINE);
    };
  }, [taskId, id, name, image]);

  const actions = useMemo(() => {
    if (!connection) {
      return null;
    }

    const { writers, attachments } = draftParts(connection.doc);

    return {
      coAuthors: () =>
        [...writers.keys()].filter((each) => each !== connection.me.id),
      wrote: () => {
        if (!writers.has(connection.me.id)) {
          writers.set(connection.me.id, true);
        }
      },
      share: (attachment: SharedAttachment) => attachments.push([attachment]),
      unshare: (key: string) => {
        const at = attachments.toArray().findIndex((each) => each.key === key);

        if (at >= 0) {
          attachments.delete(at, 1);
        }
      },
    };
  }, [connection]);

  return useMemo(
    () =>
      connection && actions ? { ...connection, ...live, ...actions } : null,
    [connection, live, actions],
  );
}
