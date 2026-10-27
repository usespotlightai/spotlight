import type { Provider } from '@lexical/yjs';
import { act, render, waitFor } from '@testing-library/react';
import {
  $createTextNode,
  $getRoot,
  $isElementNode,
  type LexicalEditor,
} from 'lexical';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { applyUpdate, Doc, encodeStateAsUpdate } from 'yjs';
import { ChatEditor } from '@/components/shared/chat-input/ChatEditor';
import type { SharedDraft } from '@/hooks/useSharedDraft';

type State = Record<string, unknown>;

const awareness = (clientId: number, everyone: Map<number, State>) => {
  const listeners = new Set<() => void>();

  return {
    getLocalState: () => everyone.get(clientId) ?? null,
    getStates: () => everyone,
    on: (_type: 'update', cb: () => void) => listeners.add(cb),
    off: (_type: 'update', cb: () => void) => listeners.delete(cb),
    setLocalState: (state: State | null) => {
      if (state) {
        everyone.set(clientId, state);
      } else {
        everyone.delete(clientId);
      }
    },
    setLocalStateField: (field: string, value: unknown) =>
      everyone.set(clientId, { ...everyone.get(clientId), [field]: value }),
  };
};

// Stands in for the server: a document only syncs with it once its provider connects.
const hubbed = () => {
  const hub = new Doc();

  return (doc: Doc) => {
    applyUpdate(doc, encodeStateAsUpdate(hub), hub);
    hub.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin !== doc) {
        applyUpdate(doc, update, hub);
      }
    });
    doc.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin !== hub) {
        applyUpdate(hub, update, doc);
      }
    });
  };
};

const draftFor = (
  join: (doc: Doc) => void,
  id: string,
  everyone: Map<number, State>,
): SharedDraft => {
  const doc = new Doc();
  const synced = new Set<(synced: boolean) => void>();
  const provider = {
    awareness: awareness(doc.clientID, everyone),
    connect: () => {
      join(doc);
      queueMicrotask(() => {
        for (const each of synced) {
          each(true);
        }
      });
    },
    disconnect: () => undefined,
    on: (type: string, cb: (synced: boolean) => void) => {
      if (type === 'sync') {
        synced.add(cb);
      }
    },
    off: () => undefined,
  } as unknown as Provider;

  return {
    name: 'task-draft:task_1',
    doc,
    provider,
    me: { id, name: id, image: null, color: '#2563eb' },
    online: true,
    synced: true,
    generation: 0,
    sentText: '',
    attachments: [],
    coAuthors: () => [],
    wrote: vi.fn(),
    share: () => undefined,
    unshare: () => undefined,
  };
};

const mount = (shared: SharedDraft) => {
  const handle = createRef<LexicalEditor | null>() as {
    current: LexicalEditor | null;
  };

  render(
    <ChatEditor
      label={`Answer as ${shared.me.id}`}
      placeholder="Reply…"
      initialReferences={[]}
      handle={handle}
      editable
      disabled={false}
      onEnter={() => undefined}
      onWritten={() => undefined}
      shared={shared}
    />,
  );

  return handle;
};

const textOf = (editor: LexicalEditor | null) =>
  editor?.getEditorState().read(() => $getRoot().getTextContent()) ?? '';

const typeInto = (editor: LexicalEditor | null, text: string) =>
  act(() => {
    editor?.update(() => {
      const first = $getRoot().getFirstChild();

      if ($isElementNode(first)) {
        first.append($createTextNode(text));
      }
    });
  });

describe('ChatEditor on a shared draft', () => {
  it('shows what one writer types to the other, and counts only local typing as writing', async () => {
    const join = hubbed();
    const everyone = new Map<number, State>();
    const ada = draftFor(join, 'ada', everyone);
    const bea = draftFor(join, 'bea', everyone);

    const adas = mount(ada);
    await waitFor(() =>
      expect(
        adas.current?.getEditorState().read(() => $getRoot().getChildrenSize()),
      ).toBe(1),
    );
    const beas = mount(bea);

    await typeInto(adas.current, 'Cap the retries at 500.');

    await waitFor(() =>
      expect(textOf(beas.current)).toBe('Cap the retries at 500.'),
    );
    expect(ada.wrote).toHaveBeenCalled();
    expect(bea.wrote).not.toHaveBeenCalled();
  });
});
