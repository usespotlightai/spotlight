import type { Provider } from '@lexical/yjs';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
import { ChatInput } from '@/components/shared/chat-input/ChatInput';
import type { DraftHandle } from '@/hooks/useChatDraft';
import type { SharedDraft } from '@/hooks/useSharedDraft';
import type { Outgoing } from '@/lib/chat-input';
import { textOf as textIn, write } from '@/test/lexical';

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

  it('leaves the local draft alone while the draft is shared', async () => {
    const draft: DraftHandle = {
      content: null,
      fresh: true,
      settings: {},
      save: vi.fn(),
      discard: vi.fn(),
    };
    const ada = draftFor(hubbed(), 'ada', new Map<number, State>());

    render(
      <ChatInput
        slug="acme"
        label="Answer as ada"
        placeholder="Reply…"
        pending={false}
        settings={null}
        onSend={vi.fn()}
        shared={ada}
        draft={draft}
      />,
    );
    const box = await screen.findByRole('textbox', { name: 'Answer as ada' });
    await waitFor(() => expect(box).toHaveAttribute('contenteditable', 'true'));
    await write(box, 'Cap the retries at 500.');

    expect(ada.wrote).toHaveBeenCalled();
    expect(draft.save).not.toHaveBeenCalled();
  });

  describe('when the send is refused', () => {
    const writers = async () => {
      const join = hubbed();
      const everyone = new Map<number, State>();
      const ada = draftFor(join, 'ada', everyone);
      const bea = draftFor(join, 'bea', everyone);
      const sent: { message: Outgoing; restore: (error?: unknown) => void }[] =
        [];
      const inputFor = (shared: SharedDraft) => (
        <ChatInput
          slug="acme"
          label={`Answer as ${shared.me.id}`}
          placeholder="Reply…"
          pending={false}
          settings={null}
          onSend={(message, restore) => sent.push({ message, restore })}
          shared={shared}
        />
      );
      const view = render(inputFor(ada));
      render(inputFor(bea));
      const boxOf = async (who: string) => {
        const box = await screen.findByRole('textbox', {
          name: `Answer as ${who}`,
        });
        await waitFor(() =>
          expect(box).toHaveAttribute('contenteditable', 'true'),
        );
        return box;
      };
      const adas = await boxOf('ada');
      const beas = await boxOf('bea');
      await write(adas, 'Cap the retries at 500.');
      await waitFor(() => expect(textIn(beas)).toBe('Cap the retries at 500.'));
      await userEvent.click(
        within(adas.closest('form') as HTMLElement).getByRole('button', {
          name: 'Send',
        }),
      );
      await waitFor(() => expect(textIn(beas)).toBe(''));

      return { ada, adas, beas, sent, view, inputFor };
    };

    it('gives both writers the text back when the generation is unchanged', async () => {
      const { adas, beas, sent } = await writers();

      expect(sent[0]?.message.draftGeneration).toBe(0);
      act(() => sent[0]?.restore(new Error('refused')));

      await waitFor(() => expect(textIn(adas)).toBe('Cap the retries at 500.'));
      await waitFor(() => expect(textIn(beas)).toBe('Cap the retries at 500.'));
    });

    it('gives nothing back when a teammate sent the draft first', async () => {
      const { ada, adas, beas, sent, view, inputFor } = await writers();

      view.rerender(inputFor({ ...ada, generation: 1 }));
      act(() => sent[0]?.restore(new Error('already sent')));

      expect(textIn(adas)).toBe('');
      expect(textIn(beas)).toBe('');
    });
  });
});
