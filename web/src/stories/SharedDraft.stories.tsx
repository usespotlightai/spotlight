import type { Provider } from '@lexical/yjs';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useMemo, useState } from 'react';
import { applyUpdate, Doc, encodeStateAsUpdate } from 'yjs';
import { ChatInput } from '@/components/shared/chat-input/ChatInput';
import type { SharedDraft } from '@/hooks/useSharedDraft';
import {
  colorOf,
  type DraftPerson,
  draftParts,
  peopleIn,
  type SharedAttachment,
} from '@/lib/shared-draft';

type State = Record<string, unknown>;

// Stands in for the sync server: one document and one set of presences that every writer joins.
class Room {
  readonly doc = new Doc();
  readonly states = new Map<number, State>();
  private readonly listeners = new Set<() => void>();

  join(doc: Doc): void {
    applyUpdate(doc, encodeStateAsUpdate(this.doc), this);
    this.doc.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin !== doc) {
        applyUpdate(doc, update, this);
      }
    });
    doc.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin !== this) {
        applyUpdate(this.doc, update, doc);
      }
    });
  }

  set(clientId: number, state: State | null): void {
    if (
      JSON.stringify(this.states.get(clientId) ?? null) ===
      JSON.stringify(state)
    ) {
      return;
    }

    if (state) {
      this.states.set(clientId, state);
    } else {
      this.states.delete(clientId);
    }

    for (const each of this.listeners) {
      each();
    }
  }

  on(listener: () => void): void {
    this.listeners.add(listener);
  }

  off(listener: () => void): void {
    this.listeners.delete(listener);
  }
}

const providerFor = (room: Room, doc: Doc): Provider => {
  const synced = new Set<(synced: boolean) => void>();
  const id = doc.clientID;

  return {
    awareness: {
      getLocalState: () => room.states.get(id) ?? null,
      getStates: () => room.states,
      on: (_type: 'update', cb: () => void) => room.on(cb),
      off: (_type: 'update', cb: () => void) => room.off(cb),
      setLocalState: (state: State | null) => room.set(id, state),
      setLocalStateField: (field: string, value: unknown) =>
        room.set(id, { ...room.states.get(id), [field]: value }),
    } as unknown as Provider['awareness'],
    connect: () => {
      room.join(doc);
      queueMicrotask(() => {
        for (const each of synced) {
          each(true);
        }
      });
    },
    disconnect: () => undefined,
    on: ((type: string, cb: (synced: boolean) => void) => {
      if (type === 'sync') {
        synced.add(cb);
      }
    }) as Provider['on'],
    off: ((type: string, cb: (synced: boolean) => void) => {
      if (type === 'sync') {
        synced.delete(cb);
      }
    }) as Provider['off'],
  };
};

const useRoomDraft = (room: Room, person: Omit<DraftPerson, 'color'>) => {
  const [doc] = useState(() => new Doc());
  const provider = useMemo(() => providerFor(room, doc), [room, doc]);
  const me = useMemo(
    () => ({ ...person, color: colorOf(person.id) }),
    [person],
  );
  const [others, setOthers] = useState<DraftPerson[]>([]);
  const [attachments, setAttachments] = useState<SharedAttachment[]>([]);

  useEffect(() => {
    const parts = draftParts(doc);
    const showOthers = () =>
      setOthers(peopleIn(room.states).filter((each) => each.id !== me.id));
    const showAttachments = () => setAttachments(parts.attachments.toArray());

    room.on(showOthers);
    parts.attachments.observe(showAttachments);

    return () => {
      room.off(showOthers);
      parts.attachments.unobserve(showAttachments);
    };
  }, [room, doc, me.id]);

  return useMemo((): SharedDraft => {
    const { writers, attachments: shared } = draftParts(doc);

    return {
      name: 'task-draft:task_retries',
      doc,
      provider,
      me,
      others,
      online: true,
      synced: true,
      generation: 0,
      sentText: '',
      attachments,
      coAuthors: () => [...writers.keys()].filter((each) => each !== me.id),
      wrote: () => writers.set(me.id, true),
      share: (attachment) => shared.push([attachment]),
      unshare: (key) => {
        const at = shared.toArray().findIndex((each) => each.key === key);

        if (at >= 0) {
          shared.delete(at, 1);
        }
      },
    };
  }, [doc, provider, me, others, attachments]);
};

const ADA = { id: 'user_ada', name: 'Ada Lovelace', image: null };
const BEA = { id: 'user_bea', name: 'Bea Okafor', image: null };

function Writer({
  room,
  person,
}: {
  room: Room;
  person: Omit<DraftPerson, 'color'>;
}) {
  const shared = useRoomDraft(room, person);

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-muted-foreground text-xs">{person.name}’s screen</h2>
      <ChatInput
        slug="acme"
        label={`Message Implementation as ${person.name}`}
        placeholder="Write a message…"
        pending={false}
        settings={null}
        shared={shared}
        onSend={(_message, sent) => sent()}
      />
    </section>
  );
}

function SharedDraftPage() {
  const [room] = useState(() => new Room());

  return (
    <div className="grid gap-8 p-8 md:grid-cols-2">
      <Writer room={room} person={ADA} />
      <Writer room={room} person={BEA} />
    </div>
  );
}

const meta = {
  title: 'Team/Runs/Run/Shared draft',
  component: SharedDraftPage,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SharedDraftPage>;

export default meta;

export const TwoWriters: StoryObj<typeof meta> = {};
