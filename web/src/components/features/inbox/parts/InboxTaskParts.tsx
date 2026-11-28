import { StationAlertCard } from '@/components/features/inbox/alerts/StationAlertCard';
import { ProposedMemories } from '@/components/features/inbox/memories/ProposedMemories';
import { JudgeQuestionPart } from '@/components/features/inbox/parts/JudgeQuestionPart';
import { type InboxItem, type InboxPart, requestPartsOf } from '@/lib/inbox';
import { SettledPartContext } from '@/lib/settled-part';
import { cn } from '@/lib/utils';

type InboxTaskPartsProps = {
  slug: string;
  item: InboxItem;
  openAt?: string | null;
};

const scrolledTo = (node: HTMLElement | null): void => {
  node?.scrollIntoView({ block: 'start' });
};

const PART_TITLES: Record<NonNullable<InboxPart['form']>, string> = {
  'judge-disagreement': 'Judge question',
  memories: 'Proposed memories',
  alert: 'Station alert',
};

function PartBody({
  slug,
  item,
  part,
}: {
  slug: string;
  item: InboxItem;
  part: InboxPart;
}) {
  const about = part.about ?? '';

  switch (part.form) {
    case 'judge-disagreement':
      return (
        <JudgeQuestionPart
          slug={slug}
          teamId={item.teamId}
          disagreementId={about}
        />
      );
    case 'memories':
      return (
        <ProposedMemories
          slug={slug}
          teamId={item.teamId}
          taskId={item.taskId}
          runId={about}
        />
      );
    case 'alert':
      return (
        <StationAlertCard slug={slug} teamId={item.teamId} alertId={about} />
      );
    case null:
      return null;
  }
}

export function InboxTaskParts({
  slug,
  item,
  openAt = null,
}: InboxTaskPartsProps) {
  const parts = requestPartsOf(item);

  if (parts.length === 0) {
    return null;
  }

  return (
    <ol aria-label="Also waiting on this task" className="flex flex-col gap-6">
      {parts.map((part) => (
        <li
          key={part.id}
          ref={part.id === openAt ? scrolledTo : undefined}
          data-part={part.id}
          aria-label={PART_TITLES[part.form ?? 'judge-disagreement']}
          className={cn('flex flex-col gap-2', !part.open && 'opacity-80')}
        >
          <p className="flex items-center gap-2 text-muted-foreground text-xs">
            <span className="font-medium">
              {PART_TITLES[part.form ?? 'judge-disagreement']}
            </span>
            {part.unread && (
              <span className="font-medium text-primary">New</span>
            )}
            {!part.open && <span>Resolved</span>}
          </p>

          <SettledPartContext value={!part.open}>
            <PartBody slug={slug} item={item} part={part} />
          </SettledPartContext>
        </li>
      ))}
    </ol>
  );
}
