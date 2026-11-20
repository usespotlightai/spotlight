import { ApprovalCard } from '@/components/features/inbox/conversation/approval/ApprovalCard';
import { ConnectionCard } from '@/components/features/inbox/conversation/connection/ConnectionCard';
import type { Deciding } from '@/components/features/inbox/conversation/Conversation';
import type { DockedDecision } from '@/lib/decision-tray';
import type { Note } from '@/lib/inbox';

export const approvalDecisionId = (note: Note): string =>
  `approval:${note.position}`;

export const connectionDecisionId = (note: Note): string =>
  `connection:${note.position}`;

type NoteDecisionsOptions = {
  teamId: string | undefined;
  viewer: string | null;
  deciding: Deciding | undefined;
  asking: number | null;
};

export const noteDecisions = (
  notes: readonly Note[],
  { teamId, viewer, deciding, asking }: NoteDecisionsOptions,
): DockedDecision[] =>
  notes.flatMap((note): DockedDecision[] => {
    const { approval, connection } = note;

    if (
      approval?.status === 'pending' &&
      deciding &&
      note.position === asking
    ) {
      return [
        {
          id: approvalDecisionId(note),
          kind: 'Approval',
          label: 'Approval',
          group: 'Approvals',
          content: (
            <ApprovalCard
              approval={approval}
              viewerId={viewer}
              pending={deciding.pending}
              onDecide={(answer) =>
                deciding.onDecide({ ...answer, ask: note.position })
              }
            />
          ),
        },
      ];
    }

    if (connection && !connection.met) {
      return [
        {
          id: connectionDecisionId(note),
          kind: 'Connection',
          label: `Connect ${connection.integrationName}`,
          group: 'Connections',
          content: (
            <ConnectionCard
              connection={connection}
              teamId={teamId}
              viewer={viewer}
            />
          ),
        },
      ];
    }

    return [];
  });
