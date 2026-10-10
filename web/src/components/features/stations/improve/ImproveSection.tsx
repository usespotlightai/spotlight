import { type ReactNode, useId } from 'react';

export function ImproveSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-1.5">
      <h2 id={titleId} className="font-medium text-foreground text-xs">
        {title}
      </h2>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}
