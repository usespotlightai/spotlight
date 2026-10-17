import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { StationIcon } from '@/components/features/board/column/StationIcon';
import { ApprovalCard } from '@/components/features/inbox/conversation/approval/ApprovalCard';
import type { Deciding } from '@/components/features/inbox/conversation/Conversation';
import { ConnectionCard } from '@/components/features/inbox/conversation/connection/ConnectionCard';
import { InboxWork } from '@/components/features/inbox/conversation/InboxWork';
import { PersonSaid } from '@/components/features/inbox/conversation/PersonSaid';
import { SaidCard } from '@/components/features/inbox/conversation/SaidCard';
import { SetupSteps } from '@/components/features/onboarding/SetupSteps';
import { AttachmentTiles } from '@/components/shared/attachment/AttachmentTiles';
import { MarkdownEditor } from '@/components/shared/form/MarkdownEditor';
import { useSession } from '@/hooks/api/useSession';
import {
  type Conversing,
  type InboxMessage as Message,
  type RunJournal,
  STICKY_AT_TOP,
} from '@/lib/inbox';
import { stationShare } from '@/lib/station';

type InboxMessageProps = {
  message: Message;
  stationCount: number;
  worked: readonly RunJournal[];
  teamId: string | undefined;
  about: Conversing['about'];
  resolved: Conversing['resolved'];
  deciding?: Deciding;
};

export function InboxMessage({
  message,
  stationCount,
  worked,
  teamId,
  about,
  resolved,
  deciding,
}: InboxMessageProps) {
  const navigate = useNavigate();
  const { data: session } = useSession();
  const written = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = written.current;

    if (!element) {
      return;
    }

    const following = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement).closest('a');
      const href = anchor?.getAttribute('href');

      if (!href?.startsWith('/') || event.metaKey || event.ctrlKey) {
        return;
      }

      event.preventDefault();
      void navigate(href);
    };

    element.addEventListener('click', following);

    return () => element.removeEventListener('click', following);
  }, [navigate]);

  if (message.form === 'settled') {
    return null;
  }

  if (message.voice === 'world') {
    return (
      <li data-note={message.position} className="-mx-3">
        <div className="flex flex-col items-start gap-1.5">
          <AttachmentTiles attachments={message.attachments} />

          {message.body && (
            <SaidCard>
              <p className="whitespace-pre-wrap text-foreground text-sm leading-6">
                {message.body}
              </p>
            </SaidCard>
          )}
        </div>
      </li>
    );
  }

  if (message.voice === 'person') {
    return (
      <li data-note={message.position} className={STICKY_AT_TOP}>
        <PersonSaid body={message.body} attachments={message.attachments} />
      </li>
    );
  }

  const shows = message.form === 'setup' && teamId;
  const approval = message.approval;
  const connection = message.connection;

  return (
    <li data-note={message.position} className="flex flex-col gap-1.5">
      {!shows && (
        <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
          <StationIcon
            share={stationShare(message.stationPosition, stationCount)}
            color={message.stationColor}
          />
          {message.station}
        </span>
      )}

      {worked.length > 0 && <InboxWork journals={worked} />}

      {approval ? (
        <ApprovalCard
          approval={approval}
          viewerId={session?.user.id ?? null}
          pending={deciding?.pending ?? false}
          onDecide={deciding?.onDecide}
        />
      ) : shows ? (
        <SetupSteps
          teamId={teamId}
          body={message.body}
          about={about}
          resolved={Boolean(resolved)}
        />
      ) : (
        <div ref={written}>
          <MarkdownEditor
            readOnly
            initialValue={message.body}
            placeholder=""
            ariaLabel={`What ${message.station} said`}
            className="border-none bg-transparent p-0"
          />
        </div>
      )}

      {connection && (
        <ConnectionCard
          connection={connection}
          teamId={teamId}
          viewer={session?.user.id ?? null}
        />
      )}

      <AttachmentTiles attachments={message.attachments} />
    </li>
  );
}
