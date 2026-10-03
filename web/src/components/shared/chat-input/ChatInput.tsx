import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { PlainTextPlugin } from '@lexical/react/LexicalPlainTextPlugin';
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  type LexicalEditor,
  type LexicalNode,
} from 'lexical';
import { ArrowUp, Plus, Square } from 'lucide-react';
import {
  type CSSProperties,
  type FormEvent,
  type ReactNode,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AttachButton } from '@/components/shared/attachment/AttachButton';
import { EditorHandle } from '@/components/shared/chat-input/EditorHandle';
import { ImageThumbs } from '@/components/shared/chat-input/ImageThumbs';
import {
  $createReferenceNode,
  ReferenceNode,
} from '@/components/shared/chat-input/ReferenceNode';
import { SendOnEnter } from '@/components/shared/chat-input/SendOnEnter';
import { WatchMessage } from '@/components/shared/chat-input/WatchMessage';
import { Button } from '@/components/ui/button';
import { useAttachments } from '@/hooks/useAttachments';
import type { SharedTrace } from '@/lib/chat';
import {
  type Outgoing,
  type Reference,
  ReferenceStates,
  type Written,
} from '@/lib/chat-input';
import { cn } from '@/lib/utils';

type Sending =
  | { disabled: true; pending?: never; onSend?: never }
  | {
      disabled?: false;
      pending: boolean;
      onSend: (message: Outgoing, sent: () => void) => void;
    };

type ChatInputProps = Sending & {
  slug: string;
  label: string;
  placeholder: string;
  running?: boolean;
  onStop?: () => void;
  initialTraces?: readonly SharedTrace[];
  above?: ReactNode;
  settings: ReactNode;
  below?: ReactNode;
};

const NOTHING: Written = { text: '', references: [] };

const ONE_LINE = 30;

const FIT_MARGIN = 8;

const COMPACT: CSSProperties = {
  gridTemplateColumns: 'auto minmax(0, 1fr) auto auto',
  gridTemplateAreas: '"plus editor settings send"',
};

const EXPANDED: CSSProperties = {
  gridTemplateColumns: 'auto minmax(0, 1fr) auto',
  gridTemplateAreas:
    '"top top top" "editor editor editor" "plus settings send"',
};

const GREYED =
  'pointer-events-none opacity-50 [&_.truncate]:text-foreground! [&_button]:text-foreground! [&_svg]:text-foreground!';

const traceReference = (trace: SharedTrace): Reference => ({
  kind: 'trace',
  key: trace.taskId,
  name: trace.title,
});

const widthOf = (parent: Element | null | undefined): number =>
  [...(parent?.children ?? [])].reduce(
    (sum, each) => sum + (each as HTMLElement).offsetWidth,
    0,
  );

const spaced = (nodes: readonly LexicalNode[]): LexicalNode[] =>
  nodes.flatMap((node) => [node, $createTextNode(' ')]);

export function ChatInput({
  slug,
  label,
  placeholder,
  pending = false,
  running = false,
  onStop,
  initialTraces = [],
  above,
  settings,
  below,
  onSend,
  disabled = false,
}: ChatInputProps) {
  const draft = useAttachments(slug);
  const editor = useRef<LexicalEditor | null>(null);
  const [written, setWritten] = useState<Written>(
    initialTraces.length > 0
      ? { text: '', references: initialTraces.map(traceReference) }
      : NOTHING,
  );

  const [initialConfig] = useState(() => ({
    namespace: 'chat-input',
    nodes: [ReferenceNode],
    onError: (error: Error) => {
      throw error;
    },
    editorState:
      initialTraces.length > 0
        ? () => {
            const paragraph = $createParagraphNode();
            paragraph.append(
              ...spaced(
                initialTraces.map((each) =>
                  $createReferenceNode(traceReference(each)),
                ),
              ),
            );
            $getRoot().append(paragraph);
          }
        : undefined,
  }));

  const images = draft.attachments.filter((each) => each.preview !== null);
  const inner = useRef<HTMLDivElement>(null);
  const writing = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [wrapped, setWrapped] = useState(false);
  const expanded = wrapped || images.length > 0 || Boolean(above);

  const room = useRef<number | null>(null);

  const measure = useEffectEvent(() => {
    const box = inner.current;
    const field = writing.current?.querySelector('[contenteditable]');
    if (!box || !field) {
      return;
    }

    setHeight(box.offsetHeight);

    if (!expanded) {
      room.current = field.clientWidth;
      if (field.scrollHeight > ONE_LINE) {
        setWrapped(true);
      }
      return;
    }

    if (field.scrollHeight > ONE_LINE) {
      return;
    }

    const line = widthOf(field.firstElementChild);

    if (room.current !== null && line + FIT_MARGIN <= room.current) {
      setWrapped(false);
    }
  });

  useLayoutEffect(() => {
    const box = inner.current;
    const area = writing.current;
    if (!box || !area) {
      return;
    }

    const measured = new ResizeObserver(() => measure());
    measured.observe(box);
    measured.observe(area);

    return () => measured.disconnect();
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: measure again once what is written has rendered
  useLayoutEffect(() => measure(), [written]);

  const placed = new Set(
    written.references.flatMap((each) =>
      each.kind === 'file' ? [each.key] : [],
    ),
  );
  const traced = written.references.filter((each) => each.kind === 'trace');
  const said = written.text.trim();

  const included = draft.attachments.filter(
    (each) => each.preview !== null || placed.has(each.key),
  );
  const ids = included.flatMap((each) =>
    each.state === 'ready' ? [each.id] : [],
  );
  const uploading = included.some((each) => each.state === 'uploading');

  const states = useMemo(
    () => new Map(draft.attachments.map((each) => [each.key, each])),
    [draft.attachments],
  );

  const empty = !said && ids.length === 0 && traced.length === 0 && !above;
  const unsendable = disabled || empty || uploading || pending;
  const showStop = !disabled && running && Boolean(onStop) && empty;

  const attach = (picked: readonly File[]) => {
    const added = draft.add(picked).filter((each) => each.preview === null);

    if (added.length === 0) {
      return;
    }

    editor.current?.update(() => {
      const selection = $getSelection();
      const nodes = spaced(
        added.map((each) =>
          $createReferenceNode({
            kind: 'file',
            key: each.key,
            name: each.name,
          }),
        ),
      );

      if ($isRangeSelection(selection)) {
        selection.insertNodes(nodes);
      } else {
        $getRoot().selectEnd().insertNodes(nodes);
      }
    });
  };

  const send = (event?: FormEvent) => {
    event?.preventDefault();

    if (unsendable || !onSend) {
      return;
    }

    onSend(
      {
        body: said,
        attachments: ids,
        traces: traced.map((each) => each.key),
      },
      () => {
        editor.current?.update(() => {
          $getRoot().clear().append($createParagraphNode());
        });
        draft.clear();
      },
    );
  };

  const sendButton = showStop ? (
    <Button
      type="button"
      size="icon-sm"
      className="rounded-full"
      onClick={onStop}
      aria-label="Stop"
    >
      <Square className="size-3 fill-current" />
    </Button>
  ) : (
    <Button
      type="submit"
      size="icon-sm"
      className="rounded-full"
      disabled={unsendable}
      aria-label="Send"
    >
      <ArrowUp />
    </Button>
  );

  return (
    <div className="flex flex-col gap-1.5">
      <form
        onSubmit={send}
        {...(!disabled && draft.handlersFor(attach))}
        style={height === null ? undefined : { height }}
        className="box-content overflow-hidden rounded-2xl border border-border bg-surface shadow-xs transition-[height] duration-200 ease-out-quad motion-reduce:transition-none"
      >
        <div
          ref={inner}
          data-expanded={expanded || undefined}
          style={expanded ? EXPANDED : COMPACT}
          className={cn(
            'grid items-center gap-x-1 gap-y-2 p-1.5',
            expanded && 'pt-0.5',
          )}
        >
          {expanded && (above || images.length > 0) && (
            <div style={{ gridArea: 'top' }} className="px-1.5 pt-1">
              {above}
              <ImageThumbs images={images} onRemove={draft.remove} />
            </div>
          )}

          <div
            ref={writing}
            style={{ gridArea: 'editor' }}
            className="relative min-w-0 px-1.5"
          >
            <ReferenceStates value={states}>
              <LexicalComposer initialConfig={initialConfig}>
                <PlainTextPlugin
                  contentEditable={
                    <ContentEditable
                      aria-label={label}
                      aria-placeholder={placeholder}
                      placeholder={
                        <p
                          className={cn(
                            'pointer-events-none absolute inset-x-1.5 top-0 truncate text-sm leading-6',
                            disabled ? 'text-faint' : 'text-muted-foreground',
                          )}
                        >
                          {placeholder}
                        </p>
                      }
                      className="max-h-56 overflow-y-auto whitespace-pre-wrap break-words text-foreground text-sm leading-6 outline-none"
                    />
                  }
                  ErrorBoundary={LexicalErrorBoundary}
                />
                <HistoryPlugin />
                <EditorHandle
                  handle={editor}
                  editable={!pending && !disabled}
                />
                <SendOnEnter send={send} />
                <WatchMessage onChange={setWritten} />
              </LexicalComposer>
            </ReferenceStates>
          </div>

          <div
            inert={disabled}
            style={{ gridArea: 'plus' }}
            className={cn('flex', disabled && GREYED)}
          >
            <AttachButton
              onAttach={attach}
              disabled={pending}
              icon={<Plus className="size-4" />}
              className="size-7 rounded-full border border-border text-muted-foreground"
            />
          </div>

          <div
            inert={disabled}
            style={{ gridArea: 'settings' }}
            className={cn(
              'flex min-w-0 items-center gap-1',
              expanded ? 'justify-start' : 'justify-end',
              disabled && GREYED,
            )}
          >
            {settings}
          </div>

          <div style={{ gridArea: 'send' }} className="flex">
            {sendButton}
          </div>
        </div>
      </form>

      {below && (
        <div
          inert={disabled}
          className={cn(
            'flex min-w-0 flex-wrap items-center gap-1 px-1',
            disabled && GREYED,
          )}
        >
          {below}
        </div>
      )}
    </div>
  );
}
