import { Plus } from 'lucide-react';
import { type ReactNode, useRef } from 'react';

import { AttachButton } from '@/components/shared/attachment/AttachButton';
import {
  ONE_LINE,
  STACKED,
} from '@/components/shared/chat-input/chat-input-layout';
import { ChatEditor } from '@/components/shared/chat-input/ChatEditor';
import { ChatInputArea } from '@/components/shared/chat-input/ChatInputArea';
import { DraftOffline } from '@/components/shared/chat-input/DraftOffline';
import { ImageThumbs } from '@/components/shared/chat-input/ImageThumbs';
import { SendOrStop } from '@/components/shared/chat-input/SendOrStop';
import type { DraftHandle } from '@/hooks/useChatDraft';
import { useChatMessage } from '@/hooks/useChatMessage';
import { useChatSending } from '@/hooks/useChatSending';
import { useFileDropTarget } from '@/hooks/useFileDropTarget';
import { useOneLineFit } from '@/hooks/useOneLineFit';
import { useReplyKey } from '@/hooks/useReplyKey';
import type { SharedDraft } from '@/hooks/useSharedDraft';
import {
  type Outgoing,
  type Reference,
  ReferenceStates,
} from '@/lib/chat-input';
import { cn } from '@/lib/utils';

type Sending =
  | { disabled: true; pending?: never; locked?: never; onSend?: never }
  | {
      disabled?: false;
      pending: boolean;
      locked?: boolean;
      onSend: (message: Outgoing, restore: (error?: unknown) => void) => void;
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
  draft?: DraftHandle;
  focusOnReply?: boolean;
};

const NO_REFERENCES: readonly Reference[] = [];

export function ChatInput({
  slug,
  label,
  placeholder,
  pending = false,
  locked = false,
  running = false,
  onStop,
  initialReferences = NO_REFERENCES,
  initialText,
  settings,
  below,
  onSend,
  disabled = false,
  shared = null,
  draft,
  focusOnReply = false,
}: ChatInputProps) {
  const cursors = useRef<HTMLDivElement>(null);
  const message = useChatMessage(
    slug,
    initialReferences,
    initialText,
    shared,
    draft,
  );
  useFileDropTarget(message.attach, { disabled });
  useReplyKey(message.editor, focusOnReply && !disabled);
  const lifted = message.images.length > 0;
  const { inner, writing, height, expanded, snaps } = useOneLineFit(
    message.written,
    lifted,
  );

  const { send, unsendable, stopping } = useChatSending({
    message,
    shared,
    disabled,
    pending: pending || locked,
    running,
    onStop,
    onSend,
  });

  return (
    <div
      className={cn('relative flex flex-col gap-1.5', disabled && 'opacity-70')}
    >
      {/* Remote cursors sit outside the form, so their name labels are not cut off at its edge. */}
      <div ref={cursors} />
      <form
        data-slot="chat-input-form"
        onSubmit={send}
        {...(!disabled && message.handlers)}
        style={height === null ? undefined : { height }}
        className={cn(
          'box-content overflow-hidden rounded-2xl border border-border bg-card shadow-xs transition-[height] duration-200 ease-out-quad motion-reduce:transition-none',
          snaps && 'transition-none',
        )}
      >
        <div
          ref={inner}
          data-expanded={expanded || undefined}
          className={cn(
            'grid items-center gap-x-1 gap-y-2 p-1.5',
            STACKED,
            !expanded && ONE_LINE,
          )}
        >
          {expanded && lifted && (
            <div style={{ gridArea: 'top' }} className="px-1.5 pt-1">
              <ImageThumbs images={message.images} onRemove={message.remove} />
            </div>
          )}

          <div
            ref={writing}
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
                initialReferences={message.seed.references}
                initialText={message.seed.text}
                handle={message.editor}
                editable={!locked && !disabled}
                disabled={disabled}
                onEnter={send}
                blank={message.blank}
                onWritten={message.setWritten}
              />
            </ReferenceStates>
          </div>

          <ChatInputArea disabled={disabled} area="plus" className="flex">
            <AttachButton
              onAttach={message.attach}
              disabled={locked}
              icon={<Plus className="size-4" />}
              className="size-7 rounded-full border border-border text-muted-foreground"
            />
          </ChatInputArea>

          <ChatInputArea
            disabled={disabled}
            area="settings"
            className={cn(
              'flex min-w-0 items-center justify-start gap-1',
              !expanded && '@md/pane:justify-end',
            )}
          >
            {settings}
          </ChatInputArea>

          <ChatInputArea disabled={disabled} area="send" className="flex">
            <SendOrStop onStop={stopping} unsendable={unsendable} />
          </ChatInputArea>
        </div>
      </form>

      <BelowInput below={below} shared={shared} disabled={disabled} />
    </div>
  );
}

type BelowInputProps = {
  below: ReactNode;
  shared: SharedDraft | null;
  disabled: boolean;
};

function BelowInput({ below, shared, disabled }: BelowInputProps) {
  if (!below && !shared) {
    return null;
  }

  return (
    <ChatInputArea
      disabled={disabled}
      className="flex min-w-0 flex-wrap items-center gap-1 px-1"
    >
      {below}
      {shared && <DraftOffline shared={shared} />}
    </ChatInputArea>
  );
}
