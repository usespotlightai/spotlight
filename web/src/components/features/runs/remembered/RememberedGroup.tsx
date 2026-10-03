import { type ReactNode, useId } from 'react';

type RememberedGroupProps = {
  title: string;
  children: ReactNode;
};

export function RememberedGroup({ title, children }: RememberedGroupProps) {
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-2">
      <h3 id={titleId} className="font-medium text-foreground text-xs">
        {title}
      </h3>
      <ul className="flex flex-col gap-2.5">{children}</ul>
    </section>
  );
}
