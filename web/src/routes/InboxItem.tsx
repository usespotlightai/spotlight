import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { Conversation } from '@/components/features/inbox/conversation/Conversation';
import { InboxAsked } from '@/components/features/inbox/conversation/InboxAsked';
import { InboxComposer } from '@/components/features/inbox/conversation/InboxComposer';
import { FailureCount } from '@/components/features/inbox/FailureCount';
import { GradeRun } from '@/components/features/inbox/grades/GradeRun';
import { InboxItemSkeleton } from '@/components/features/inbox/InboxItemSkeleton';
import { MemoryReview } from '@/components/features/inbox/memories/MemoryReview';
import { ChangesPanel } from '@/components/features/runs/ChangesPanel';
import { RunActivity } from '@/components/features/runs/RunActivity';
import { RunBriefing } from '@/components/features/runs/RunBriefing';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { PageNotice } from '@/components/shared/PageNotice';
import {
  type BreadcrumbSegment,
  Breadcrumbs,
} from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { useAnswerInboxItem } from '@/hooks/api/useAnswerInboxItem';
import { inboxKeys, useInbox } from '@/hooks/api/useInbox';
import { useReadInboxAside } from '@/hooks/api/useReadInboxAside';
import { useReadInboxItem } from '@/hooks/api/useReadInboxItem';
import { useRunStream } from '@/hooks/api/useRunStream';
import { journalKeys, useTaskJournal } from '@/hooks/api/useTaskJournal';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { shownAt, workedOn } from '@/lib/inbox';
import { failed, loading } from '@/lib/query';
import { taskPath } from '@/lib/task';
import { teamPath } from '@/lib/team';
import { useTrail } from '@/lib/trail';

export function InboxItem() {
  const { slug, itemId } = useParams();
  const [params] = useSearchParams();
  const inbox = useInbox(slug);
  const item = inbox.data?.find((each) => each.id === itemId);
  const journal = useTaskJournal(slug, item?.aside ? undefined : item?.taskId);
  const worked = journal.data;
  const { data: workspace } = useWorkspace(slug);
  const read = useReadInboxItem();
  const readAside = useReadInboxAside();
  const answer = useAnswerInboxItem();

  const queryClient = useQueryClient();

  const bump = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: journalKeys.forTask(item?.taskId),
    });
    void queryClient.invalidateQueries({
      queryKey: inboxKeys.forWorkspace(slug),
    });
  }, [queryClient, item?.taskId, slug]);

  useRunStream(item?.runId ?? undefined, Boolean(item?.working), bump);

  const seen = useRef<string | null>(null);

  useEffect(() => {
    const at = item && `${item.id}:${item.notes.length}`;

    if (!slug || !item?.unread || !at || seen.current === at) {
      return;
    }

    seen.current = at;

    if (item.aside) {
      readAside.mutate({ slug, asideId: item.id });
    } else {
      read.mutate({ slug, itemId: item.id });
    }
  }, [slug, item, read.mutate, readAside.mutate]);

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

  if (loading(inbox) || (item && !item.aside && loading(journal))) {
    return <InboxItemSkeleton />;
  }

  if (failed(inbox)) {
    return (
      <PageNotice>
        <CouldNotLoad
          what="The inbox"
          retrying={inbox.isFetching}
          onRetry={() => void inbox.refetch()}
        />
      </PageNotice>
    );
  }

  if (!item || !slug) {
    return (
      <PageNotice>
        <p className="text-muted-foreground text-sm">
          Nothing here is waiting on you any more.
        </p>
      </PageNotice>
    );
  }

  if (item.aside?.form === 'memories') {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <PageHeader title={<Breadcrumbs segments={trail} />} />

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-3xl flex-col px-8 py-8">
            <MemoryReview
              slug={slug}
              teamId={item.teamId}
              taskId={item.taskId}
              runId={item.aside.about}
            />
          </div>
        </div>
      </div>
    );
  }

  if (item.aside?.form === 'grade') {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <PageHeader title={<Breadcrumbs segments={trail} />} />

        <ChangesPanel>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto flex w-full max-w-3xl flex-col px-8 py-8">
              <GradeRun
                slug={slug}
                teamId={item.teamId}
                taskId={item.taskId}
                runId={item.aside.about}
                title={item.title}
                description={item.description}
              />
            </div>
          </div>
        </ChangesPanel>
      </div>
    );
  }

  const carriesItsOwn = item.notes[0]?.form === 'setup';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title={<Breadcrumbs segments={trail} />}
        trailing={<FailureCount failure={item.failure} />}
      />

      <ChangesPanel>
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
            resolved: item.resolved,
            notes: item.notes,
          }}
          worked={worked ?? []}
          deciding={{
            pending: answer.isPending,
            onDecide: (approve, said) =>
              answer.mutate({
                slug,
                itemId: item.id,
                body: said,
                attachments: [],
                approve,
              }),
          }}
          openAt={shownAt(item.notes, params.get('run'))}
          live={
            item.runId && item.working ? (
              <RunActivity
                journals={workedOn(worked ?? [], item.notes, item.runId)}
                working={item.working}
                station={{
                  name: item.station,
                  color: item.stationColor,
                  position: item.stationPosition,
                  count: item.stationCount,
                }}
              />
            ) : undefined
          }
          opening={
            carriesItsOwn ? undefined : item.briefing ? (
              <RunBriefing
                briefing={item.briefing}
                attachments={item.attachments}
              />
            ) : (
              <InboxAsked
                station={{ ...item.raisedAt, count: item.stationCount }}
                title={item.title}
                description={item.description}
                attachments={item.attachments}
              />
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
                taskId={item.taskId}
                station={item.station}
                teamId={item.teamId}
                runId={item.runId}
                running={item.working}
              />
            )
          }
        />
      </ChangesPanel>
    </div>
  );
}
