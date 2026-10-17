import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { StationIcon } from '@/components/features/board/column/StationIcon';
import { ApprovalCard } from '@/components/features/inbox/conversation/approval/ApprovalCard';
import type { Deciding } from '@/components/features/inbox/conversation/Conversation';
import { ConnectionCard } from '@/components/features/inbox/conversation/connection/ConnectionCard';
import { InboxWork } from '@/components/features/inbox/conversation/InboxWork';
import { MessageCard } from '@/components/features/inbox/conversation/MessageCard';
import { PersonMessage } from '@/components/features/inbox/conversation/PersonMessage';
import { SetupSteps } from '@/components/features/onboarding/SetupSteps';
import { AttachmentTiles } from '@/components/shared/attachment/AttachmentTiles';
import { MarkdownEditor } from '@/components/shared/form/MarkdownEditor';
import { useSession } from '@/hooks/api/useSession';
import {
  type Conversing,
  type Note,
  type RunJournal,
  STICKY_AT_TOP,
} from '@/lib/inbox';
import { stationShare } from '@/lib/station';

type InboxNoteProps = {
  note: Note;
  stationCount: number;
  worked: readonly RunJournal[];
  teamId: string | undefined;
  about: Conversing['about'];
  resolved: Conversing['resolved'];
  deciding?: Deciding;
};

export function InboxNote({
  note,
  stationCount,
  worked,
  teamId,
  about,
  resolved,
  deciding,
}: InboxNoteProps) {
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

  if (note.form === 'resolved') {
    return null;
  }

  if (note.voice === 'world') {
    return (
      <li data-note={note.position} className="-mx-3">
        <div className="flex flex-col items-start gap-1.5">
          <AttachmentTiles attachments={note.attachments} />

          {note.body && (
            <MessageCard>
              <p className="whitespace-pre-wrap text-foreground text-sm leading-6">
                {note.body}
              </p>
            </MessageCard>
          )}
        </div>
      </li>
    );
  }

  if (note.voice === 'person') {
    return (
      <li data-note={note.position} className={STICKY_AT_TOP}>
        <PersonMessage body={note.body} attachments={note.attachments} />
      </li>
    );
  }

  const shows = note.form === 'setup' && teamId;
  const approval = note.approval;
  const connection = note.connection;

  return (
    <li data-note={note.position} className="flex flex-col gap-1.5">
      {!shows && (
        <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
          <StationIcon
            share={stationShare(note.stationPosition, stationCount)}
            color={note.stationColor}
          />
          {note.station}
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
          body={note.body}
          about={about}
          resolved={Boolean(resolved)}
        />
      ) : (
        <div ref={written}>
          <MarkdownEditor
            readOnly
            initialValue={note.body}
            placeholder=""
            ariaLabel={`What ${note.station} said`}
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

      <AttachmentTiles attachments={note.attachments} />
    </li>
  );
}
