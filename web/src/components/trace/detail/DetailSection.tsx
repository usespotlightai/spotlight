import type { ReactNode } from 'react';
import { DetailCopy } from '@/components/trace/detail/DetailCopy';

export function DetailSection({
  title,
  copy,
  children,
}: {
  title: string;
  copy?: string;
  children: ReactNode;
}) {
  return (
    <section className="group/section flex flex-col gap-1">
      <div className="flex h-5 items-center justify-between gap-2">
        <h3 className="font-medium text-muted-foreground text-xs">{title}</h3>
        {copy && (
          <span className="opacity-0 transition-opacity focus-within:opacity-100 group-hover/section:opacity-100">
            <DetailCopy text={copy} of={title.toLowerCase()} />
          </span>
        )}
      </div>
      {children}
    </section>
  );
}
