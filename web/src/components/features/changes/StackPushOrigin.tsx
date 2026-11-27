import type { ReactElement } from 'react';

import { type ChangeStack, shortCommit } from '@/lib/change-stack';
import { nonEmpty } from '@/lib/non-empty';

type StackPushOriginProps = {
  stack: ChangeStack;
};

export function StackPushOrigin({
  stack,
}: StackPushOriginProps): ReactElement | null {
  if (!stack.push) {
    return null;
  }

  return (
    <span
      title={`Commit ${shortCommit(stack.push.head)}`}
      className="hidden shrink-0 text-muted-foreground text-xs @md/pane:inline"
    >
      {nonEmpty(stack.push.pushedBy)
        ? `Pushed by ${stack.push.pushedBy}`
        : 'Pushed to the pull request'}
    </span>
  );
}
