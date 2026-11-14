import { StationIcon } from '@/components/features/board/column/StationIcon';
import { FailureCount } from '@/components/features/inbox/FailureCount';
import { InboxRowFrame } from '@/components/features/inbox/InboxRowFrame';
import { plainPreview } from '@/components/features/inbox/plainPreview';
import { ResolveToggle } from '@/components/features/inbox/ResolveToggle';
import { TeamWaitingMark } from '@/components/features/inbox/TeamWaitingMark';
import {
  type InboxItem,
  inboxItemPath,
  previewOf,
  waitsForTeam,
} from '@/lib/inbox';
import { stationShare } from '@/lib/station';

type InboxRowProps = {
  slug: string;
  item: InboxItem;
};

export function InboxRow({ slug, item }: InboxRowProps) {
  return (
    <InboxRowFrame
      to={inboxItemPath(slug, item.id)}
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
      badge={
        <>
          {waitsForTeam(item) && <TeamWaitingMark />}
          <FailureCount failure={item.failure} />
        </>
      }
      action={<ResolveToggle slug={slug} entry={item} />}
    />
  );
}
