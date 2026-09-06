import { useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { Conversation } from '@/components/features/inbox/conversation/Conversation';
import { InboxAsked } from '@/components/features/inbox/conversation/InboxAsked';
import { InboxComposer } from '@/components/features/inbox/conversation/InboxComposer';
import { RunBriefing } from '@/components/features/runs/RunBriefing';
import {
  type BreadcrumbSegment,
  Breadcrumbs,
} from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { useInbox } from '@/hooks/api/useInbox';
import { useReadInboxItem } from '@/hooks/api/useReadInboxItem';
import { useSession } from '@/hooks/api/useSession';
import { useTaskJournal } from '@/hooks/api/useTaskJournal';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { shownAt } from '@/lib/inbox';
import { taskPath } from '@/lib/task';
import { teamPath } from '@/lib/team';
import { useTrail } from '@/lib/trail';

export function InboxItem() {
  const { slug, itemId } = useParams();
  const [params] = useSearchParams();
  const { data: waiting } = useInbox(slug);
  const item = waiting?.find((each) => each.id === itemId);
  const { data: worked } = useTaskJournal(slug, item?.taskId);
  const { data: session } = useSession();
  const { data: workspace } = useWorkspace(slug);
  const read = useReadInboxItem();

  // Keyed by the conversation's state, not the item: an ask arriving while it
  // is open makes it unread again.
  const seen = useRef<string | null>(null);

  useEffect(() => {
    const at = item && `${item.id}:${item.notes.length}`;

    if (!slug || !item?.unread || !at || seen.current === at) {
      return;
    }

    seen.current = at;
    read.mutate({ slug, itemId: item.id });
  }, [slug, item, read.mutate]);

  const team = workspace?.teams.find(
    (candidate) => candidate.id === item?.teamId,
  );

  const base: BreadcrumbSegment[] = [
    ...(team && slug
      ? [
          {
            label: team.name,
            avatar: team.name,
            to: teamPath(slug, team.id),
          },
        ]
      : []),
    ...(item && slug
      ? [{ label: item.title, to: taskPath(slug, item.teamId, item.taskId) }]
      : []),
  ];
  const { trail } = useTrail(base);

  if (!item || !slug) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-8">
        <p className="text-muted-foreground text-sm">
          Nothing here is waiting on you any more.
        </p>
      </div>
    );
  }

  // A note that shows itself carries the opening too. Shown above it, the
  // opening reads as something the person wrote, which nobody did.
  const carriesItsOwn = item.notes[0]?.form === 'setup';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title={<Breadcrumbs segments={trail} />} />

      <Conversation
        item={{
          id: item.id,
          teamId: item.teamId,
          about: carriesItsOwn
            ? { title: item.title, description: item.description }
            : undefined,
          createdAt: item.createdAt,
          station: {
            name: item.station,
            color: item.stationColor,
            position: item.stationPosition,
            count: item.stationCount,
          },
          working: item.working,
          notes: item.notes,
        }}
        worked={worked ?? []}
        viewerId={session?.user.id}
        openAt={shownAt(item.notes, params.get('run'))}
        opening={
          carriesItsOwn ? undefined : item.briefing ? (
            <RunBriefing briefing={item.briefing} />
          ) : (
            <InboxAsked item={item} />
          )
        }
        footer={
          carriesItsOwn ? null : item.resolved ? (
            <p className="text-center text-muted-foreground text-xs">
              {item.standsAt.name === item.station
                ? 'This is settled. There is nothing left to answer.'
                : `This moved on to ${item.standsAt.name}. There is nothing left to answer.`}
            </p>
          ) : (
            <InboxComposer
              slug={slug}
              itemId={item.id}
              station={item.station}
            />
          )
        }
      />
    </div>
  );
}
