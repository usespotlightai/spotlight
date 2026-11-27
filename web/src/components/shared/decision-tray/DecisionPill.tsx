import type { ReactElement } from 'react';

import { PillButton } from '@/components/shared/PillButton';

type DecisionPillProps = {
  label: string;
  current: boolean;
  onShow: () => void;
};

export function DecisionPill({
  label,
  current,
  onShow,
}: DecisionPillProps): ReactElement {
  return (
    <PillButton
      data-slot="decision-pill"
      data-current={current || undefined}
      size="regular"
      aria-label={`Show ${label}`}
      className="max-w-64 gap-1.75 px-2.5 font-normal text-sm"
      onClick={onShow}
    >
      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-primary" />
      <span data-pill-label className="truncate">
        {label}
      </span>
    </PillButton>
  );
}
