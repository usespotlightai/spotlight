import { type ReactElement, type ReactNode, useRef } from 'react';

import { ApprovalCard } from '@/components/features/inbox/conversation/approval/ApprovalCard';
import { ConnectionCard } from '@/components/features/inbox/conversation/connection/ConnectionCard';
import type { Deciding } from '@/components/features/inbox/conversation/Conversation';
import { InboxWork } from '@/components/features/inbox/conversation/InboxWork';
import {
  approvalDecisionId,
  connectionDecisionId,
} from '@/components/features/inbox/conversation/noteDecisions';
import { PromptDisclosure } from '@/components/features/inbox/conversation/PromptDisclosure';
import { StationTag } from '@/components/features/inbox/conversation/StationTag';
import { SetupSteps } from '@/components/features/onboarding/SetupSteps';
import { AttachmentTiles } from '@/components/shared/attachment/AttachmentTiles';
import { Dockable } from '@/components/shared/decision-tray/Dockable';
import { MarkdownEditor } from '@/components/shared/form/MarkdownEditor';
import { useSession } from '@/hooks/api/useSession';
import { useInAppLinks } from '@/hooks/useInAppLinks';
import { useJournalSight } from '@/hooks/useJournalSight';
import {
  ARRIVING,
  type ConversationItem,
  type Note,
  type RunJournal,
} from '@/lib/inbox';
import { nonEmpty } from '@/lib/non-empty';
import { cn } from '@/lib/utils';

type InboxNoteProps = {
  note: Note;
  stationCount: number;
  worked: readonly RunJournal[];
  teamId: string | undefined;
  about: ConversationItem['about'];
  resolved: ConversationItem['resolved'];
  deciding?: Deciding;
  outdated?: boolean;
  suggestion?: ReactNode;
  arrived?: boolean;
  prompt?: string;
};

export function InboxNote({
  note,
  stationCount,
  worked,
  teamId,
  about,
  resolved,
  deciding,
  outdated = false,
  suggestion,
  arrived = false,
  prompt,
}: InboxNoteProps): ReactElement {
  const { data: session } = useSession();
  const sight = useJournalSight();
  const written = useRef<HTMLDivElement>(null);
  const arriving = arrived ? ARRIVING : undefined;
  useInAppLinks(written);

  const shows = note.form === 'setup' && nonEmpty(teamId);
  const approval = note.approval;
  const connection = note.connection;

  return (
    <li
      ref={sight(nonEmpty(note.runId) ? [note.runId] : [])}
      data-note={note.position}
      className={cn('flex flex-col gap-1.5', arriving)}
    >
      {!shows && (
        <StationTag
          name={note.station}
          color={note.stationColor}
          position={note.stationPosition}
          count={stationCount}
        />
      )}

      {nonEmpty(prompt) && <PromptDisclosure prompt={prompt} />}

      {worked.length > 0 && <InboxWork journals={worked} />}

      {approval ? (
        <Dockable id={approvalDecisionId(note)}>
          <ApprovalCard
            approval={approval}
            viewerId={session?.user.id ?? null}
            pending={deciding?.pending ?? false}
            outdated={outdated}
            onDecide={
              deciding
                ? (answer) =>
                    deciding.onDecide({ ...answer, ask: note.position })
                : undefined
            }
          />
        </Dockable>
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
        <Dockable id={connectionDecisionId(note)}>
          <ConnectionCard
            connection={connection}
            teamId={teamId}
            viewer={session?.user.id ?? null}
            outdated={outdated}
          />
        </Dockable>
      )}

      <AttachmentTiles attachments={note.attachments} />

      {suggestion}
    </li>
  );
}
