import { type ReactNode, useId } from 'react';

type RememberedGroupProps = {
  title: string;
  about: string;
  children: ReactNode;
};

export function RememberedGroup({
  title,
  about,
  children,
}: RememberedGroupProps) {
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-2">
      <header className="flex flex-col gap-0.5">
        <h3 id={titleId} className="font-medium text-foreground text-xs">
          {title}
        </h3>
        <p className="text-muted-foreground text-xs leading-5">{about}</p>
      </header>
      <ul className="flex flex-col gap-2">{children}</ul>
    </section>
  );
}
