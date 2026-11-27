import type { ReactElement } from 'react';

import { PillButton } from '@/components/shared/PillButton';

export function ThisWasWrong({
  onClick,
}: {
  onClick: () => void;
}): ReactElement {
  return <PillButton onClick={onClick}>This was wrong</PillButton>;
}
