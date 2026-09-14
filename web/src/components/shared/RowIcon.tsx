import type { ComponentType } from 'react';

type RowIconProps = {
  icon: ComponentType<{ className?: string }>;
};

export function RowIcon({ icon: Icon }: RowIconProps) {
  return (
    <span
      aria-hidden
      className="flex size-8 shrink-0 items-center justify-center rounded-full border-[0.5px] border-border bg-muted/50 text-muted-foreground"
    >
      <Icon className="size-3.5" />
    </span>
  );
}
