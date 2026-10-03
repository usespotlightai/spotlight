import { type ReactNode, useId } from 'react';

export function OutcomePart({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-2">
      <h3 id={titleId} className="font-medium text-foreground text-xs">
        {title}
      </h3>
      {children}
    </section>
  );
}
