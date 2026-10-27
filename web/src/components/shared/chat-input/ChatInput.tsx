import { Plus } from 'lucide-react';
import { type CSSProperties, type ReactNode, useRef } from 'react';
import { AttachButton } from '@/components/shared/attachment/AttachButton';
import { ChatEditor } from '@/components/shared/chat-input/ChatEditor';
import { ChatInputArea } from '@/components/shared/chat-input/ChatInputArea';
import { DraftOffline } from '@/components/shared/chat-input/DraftOffline';
import { ImageThumbs } from '@/components/shared/chat-input/ImageThumbs';
import { SendOrStop } from '@/components/shared/chat-input/SendOrStop';
import { useChatMessage } from '@/hooks/useChatMessage';
import { useChatSend } from '@/hooks/useChatSend';
import { useOneLineFit } from '@/hooks/useOneLineFit';
import type { SharedDraft } from '@/hooks/useSharedDraft';
import {
  type Outgoing,
  type Reference,
  ReferenceStates,
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
  initialReferences?: readonly Reference[];
  initialText?: string;
  settings: ReactNode;
  below?: ReactNode;
  shared?: SharedDraft | null;
};

const NO_REFERENCES: readonly Reference[] = [];

const COMPACT: CSSProperties = {
  gridTemplateColumns: 'auto minmax(0, 1fr) auto auto',
  gridTemplateAreas: '"plus editor settings send"',
};

const EXPANDED: CSSProperties = {
  gridTemplateColumns: 'auto minmax(0, 1fr) auto',
  gridTemplateAreas:
    '"top top top" "editor editor editor" "plus settings send"',
};

export function ChatInput({
  slug,
  label,
  placeholder,
  pending = false,
  running = false,
  onStop,
  initialReferences = NO_REFERENCES,
  initialText,
  settings,
  below,
  onSend,
  disabled = false,
  shared = null,
}: ChatInputProps) {
  const cursors = useRef<HTMLDivElement>(null);
  const message = useChatMessage(slug, initialReferences, initialText, shared);
  const lifted = message.images.length > 0;
  const fit = useOneLineFit(message.written, lifted);

  const { send, unsendable, stopping } = useChatSend({
    outgoing: message.outgoing,
    empty: message.blank,
    uploading: message.uploading,
    disabled,
    pending,
    running,
    onStop,
    onSend:
      onSend &&
      ((outgoing, sent) =>
        shared
          ? onSend(
              {
                ...outgoing,
                coAuthors: shared.coAuthors(),
                ...(shared.synced && { draftGeneration: shared.generation }),
              },
              () => message.clearSent(outgoing.body),
            )
          : onSend(outgoing, sent)),
    sent: message.clear,
  });

  return (
    <div className="relative flex flex-col gap-1.5">
      {/* Remote cursors sit outside the form, so their name labels are not cut off at its edge. */}
      <div ref={cursors} />
      <form
        onSubmit={send}
        {...(!disabled && message.handlers)}
        style={fit.height === null ? undefined : { height: fit.height }}
        className="box-content overflow-hidden rounded-2xl border border-border bg-card shadow-xs transition-[height] duration-200 ease-out-quad motion-reduce:transition-none"
      >
        <div
          ref={fit.inner}
          data-expanded={fit.expanded || undefined}
          style={fit.expanded ? EXPANDED : COMPACT}
          className={cn(
            'grid items-center gap-x-1 gap-y-2 p-1.5',
            fit.expanded && 'pt-0.5',
          )}
        >
          {fit.expanded && lifted && (
            <div style={{ gridArea: 'top' }} className="px-1.5 pt-1">
              <ImageThumbs images={message.images} onRemove={message.remove} />
            </div>
          )}

          <div
            ref={fit.writing}
            style={{ gridArea: 'editor' }}
            className="relative min-w-0 px-1.5"
          >
            <ReferenceStates value={message.states}>
              <ChatEditor
                key={shared?.name ?? 'alone'}
                shared={shared}
                cursors={cursors}
                label={label}
                placeholder={placeholder}
                initialReferences={initialReferences}
                initialText={initialText}
                handle={message.editor}
                editable={!pending && !disabled}
                disabled={disabled}
                onEnter={send}
                onWritten={message.setWritten}
              />
            </ReferenceStates>
          </div>

          <ChatInputArea disabled={disabled} area="plus" className="flex">
            <AttachButton
              onAttach={message.attach}
              disabled={pending}
              icon={<Plus className="size-4" />}
              className="size-7 rounded-full border border-border text-muted-foreground"
            />
          </ChatInputArea>

          <ChatInputArea
            disabled={disabled}
            area="settings"
            className={cn(
              'flex min-w-0 items-center gap-1',
              fit.expanded ? 'justify-start' : 'justify-end',
            )}
          >
            {settings}
          </ChatInputArea>

          <div style={{ gridArea: 'send' }} className="flex">
            <SendOrStop onStop={stopping} unsendable={unsendable} />
          </div>
        </div>
      </form>

      {(below || shared) && (
        <ChatInputArea
          disabled={disabled}
          className="flex min-w-0 flex-wrap items-center gap-1 px-1"
        >
          {below}
          {shared && <DraftOffline shared={shared} />}
        </ChatInputArea>
      )}
    </div>
  );
}
