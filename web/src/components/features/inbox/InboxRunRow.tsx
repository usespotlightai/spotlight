import { StationIcon } from '@/components/features/board/column/StationIcon';
import { InboxRowFrame } from '@/components/features/inbox/InboxRowFrame';
import { type InboxRun, inboxRunPath, workingWordsOf } from '@/lib/inbox';
import { stationShare } from '@/lib/station';

type InboxRunRowProps = {
  slug: string;
  run: InboxRun;
};

export function InboxRunRow({ slug, run }: InboxRunRowProps) {
  return (
    <InboxRowFrame
      to={inboxRunPath(slug, run.teamId, run.id)}
      icon={
        <StationIcon
          share={stationShare(run.stationPosition, run.stationCount)}
          color={run.stationColor}
        />
      }
      title={run.title}
      unread={false}
      at={run.askedAt}
      preview={workingWordsOf(run.progress, run.station)}
    />
  );
}
