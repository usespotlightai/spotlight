import { StationIcon } from '@/components/features/board/column/StationIcon';
import { FailureCount } from '@/components/features/inbox/FailureCount';
import { InboxRowFrame } from '@/components/features/inbox/InboxRowFrame';
import { plainPreview } from '@/components/features/inbox/plainPreview';
import { usePrefetchTaskJournal } from '@/hooks/api/useTaskJournal';
import { useResolveAction } from '@/hooks/useResolveAction';
import { useResolveAllAction } from '@/hooks/useResolveAllAction';
import { type InboxItem, inboxItemPath, previewOf } from '@/lib/inbox';
import { stationShare } from '@/lib/station';

type InboxRowProps = {
  slug: string;
  item: InboxItem;
};

export function InboxRow({ slug, item }: InboxRowProps) {
  const resolve = useResolveAction(slug, item);
  const resolveAll = useResolveAllAction(slug, item);
  const prefetch = usePrefetchTaskJournal(slug);
  return (
    <InboxRowFrame
      to={inboxItemPath(slug, item.id)}
      onIntent={
        item.inboxRequest
          ? undefined
          : () => prefetch(item.taskId, [item.runId])
      }
      icon={
        <StationIcon
          share={stationShare(item.stationPosition, item.stationCount)}
          color={item.stationColor}
        />
      }
      title={item.title}
      unread={item.unread}
      at={item.askedAt}
      preview={plainPreview(previewOf(item))}
      badge={<FailureCount failure={item.failure} />}
      resolve={resolve}
      menuActions={resolveAll ? [resolveAll] : []}
    />
  );
}
