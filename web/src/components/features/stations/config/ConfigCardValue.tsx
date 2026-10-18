import type { ReactNode } from 'react';

type ConfigCardValueProps = {
  lead?: ReactNode;
  detail?: ReactNode;
  children: ReactNode;
};

export function ConfigCardValue({
  lead,
  detail,
  children,
}: ConfigCardValueProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <p className="flex min-w-0 items-center gap-2 text-[1.375rem] text-foreground leading-tight tracking-tight">
        {lead}
        <span className="truncate">{children}</span>
      </p>
      {detail && (
        <p className="text-[0.7rem] text-muted-foreground">{detail}</p>
      )}
    </div>
  );
}
