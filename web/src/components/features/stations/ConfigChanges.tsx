import { type ConfigChange, changePhrase } from '@/lib/station-config';
import { cn } from '@/lib/utils';

type ConfigChangesProps = {
  changes: readonly ConfigChange[];
  className?: string;
};

export function ConfigChanges({ changes, className }: ConfigChangesProps) {
  if (changes.length === 0) {
    return null;
  }

  return (
    <ul
      aria-label="What changed"
      className={cn(
        'flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-muted-foreground text-xs',
        className,
      )}
    >
      {changes.map((change, at) => (
        <li
          key={`${change.part}:${change.name ?? ''}`}
          className="flex items-center gap-1.5"
        >
          {at > 0 && <span aria-hidden>·</span>}
          {changePhrase(change)}
        </li>
      ))}
    </ul>
  );
}
