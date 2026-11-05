import { useRef } from 'react';
import { StationIcon } from '@/components/features/board/column/StationIcon';
import { ApprovalCard } from '@/components/features/inbox/conversation/approval/ApprovalCard';
import type { Deciding } from '@/components/features/inbox/conversation/Conversation';
import { ConnectionCard } from '@/components/features/inbox/conversation/connection/ConnectionCard';
import { InboxWork } from '@/components/features/inbox/conversation/InboxWork';
import { SetupSteps } from '@/components/features/onboarding/SetupSteps';
import { AttachmentTiles } from '@/components/shared/attachment/AttachmentTiles';
import { MarkdownEditor } from '@/components/shared/form/MarkdownEditor';
import { useSession } from '@/hooks/api/useSession';
import { useInAppLinks } from '@/hooks/useInAppLinks';
import {
  ARRIVING,
  type ConversationItem,
  type Note,
  type RunJournal,
} from '@/lib/inbox';
import { stationShare } from '@/lib/station';
import { cn } from '@/lib/utils';

type InboxNoteProps = {
  note: Note;
  stationCount: number;
  worked: readonly RunJournal[];
  teamId: string | undefined;
  about: ConversationItem['about'];
  resolved: ConversationItem['resolved'];
  deciding?: Deciding;
  arrived?: boolean;
};

export function InboxNote({
  note,
  stationCount,
  worked,
  teamId,
  about,
  resolved,
  deciding,
  arrived = false,
}: InboxNoteProps) {
  const { data: session } = useSession();
  const written = useRef<HTMLDivElement>(null);
  const arriving = arrived ? ARRIVING : undefined;
  useInAppLinks(written);

  const shows = note.form === 'setup' && teamId;
  const approval = note.approval;
  const connection = note.connection;

  return (
    <li
      data-note={note.position}
      className={cn('flex flex-col gap-1.5', arriving)}
    >
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
            keepLineBreaks
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
