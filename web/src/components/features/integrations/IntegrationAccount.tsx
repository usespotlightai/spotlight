import type { ReactNode } from 'react';

type IntegrationAccountProps = {
  linkedAccount: string | null;
  connected: boolean;
  purpose: string;
  action?: ReactNode;
};

export function IntegrationAccount({
  linkedAccount,
  connected,
  purpose,
  action,
}: IntegrationAccountProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
      <div className="flex min-w-0 flex-1 basis-24 flex-col">
        <span
          className={connected ? 'text-foreground' : 'text-muted-foreground'}
        >
          {connected ? (linkedAccount ?? 'Connected') : 'Not connected'}
        </span>
        <span className="text-muted-foreground text-xs leading-5">
          {purpose}
        </span>
      </div>

      {action}
    </div>
  );
}
