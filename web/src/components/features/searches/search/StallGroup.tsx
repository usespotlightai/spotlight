import { type ReactNode, useId } from 'react';

type StallGroupProps = {
  kind: string;
  title: string;
  meaning: string;
  action?: string;
  children: ReactNode;
};

export function StallGroup({
  kind,
  title,
  meaning,
  action,
  children,
}: StallGroupProps) {
  const headingId = useId();

  return (
    <section
      data-slot="cause-group"
      data-cause={kind}
      aria-labelledby={headingId}
      className="flex flex-col gap-2 border-border border-t pt-3"
    >
      <div className="flex flex-col gap-0.5">
        <h3 id={headingId} className="font-medium text-foreground text-sm">
          {title}
        </h3>
        <p className="text-muted-foreground text-xs leading-5">{meaning}</p>
        {action && (
          <p className="text-foreground text-xs leading-5">{action}</p>
        )}
      </div>

      <ul aria-label={title} className="flex flex-col gap-2">
        {children}
      </ul>
    </section>
  );
}
