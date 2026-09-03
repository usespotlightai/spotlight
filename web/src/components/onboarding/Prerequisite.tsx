import { Check, Circle } from 'lucide-react';
import type { ReactNode } from 'react';

type PrerequisiteProps = {
  done: boolean;
  title: string;
  children: ReactNode;
};

/**
 * One thing a person has to go and do somewhere else. Said plainly, with
 * what to do rather than only whether it is done.
 */
export function Prerequisite({ done, title, children }: PrerequisiteProps) {
  return (
    <li className="flex gap-3 rounded-lg border border-border bg-card p-4">
      {done ? (
        <Check
          className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
          aria-label="Done"
        />
      ) : (
        <Circle
          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
          aria-label="Still to do"
        />
      )}

      <div className="flex flex-col gap-1">
        <h3 className="font-medium text-foreground text-sm">{title}</h3>
        <p className="text-muted-foreground text-xs leading-5">{children}</p>
      </div>
    </li>
  );
}
