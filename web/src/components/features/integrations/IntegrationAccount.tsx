import type { ReactNode } from 'react';

type IntegrationAccountProps = {
  handle: string | null;
  connected: boolean;
  purpose: string;
  action?: ReactNode;
};

export function IntegrationAccount({
  handle,
  connected,
  purpose,
  action,
}: IntegrationAccountProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col">
        <span
          className={connected ? 'text-foreground' : 'text-muted-foreground'}
        >
          {connected ? (handle ?? 'Connected') : 'Not connected'}
        </span>
        <span className="text-muted-foreground text-xs leading-5">
          {purpose}
        </span>
      </div>

      {action}
    </div>
  );
}
