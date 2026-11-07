import { ChangeStackReactions } from '@change-review/application/events/handlers/change-stack-reactions.handler';
import { ChangeStackCompleted } from '@change-review/domain/events/change-stack-completed.event';
import { StackChecked } from '@change-review/domain/events/stack-checked.event';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { StackCheckId } from '@change-review/domain/value-objects/stack-check-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const STACK_ID = ChangeStackId.of('stack-1');
const RUN_ID = RunId.of('run-1');

const posting = () => {
  const posted: RunId[] = [];
  const reactions = new ChangeStackReactions({
    ofRun: async (runId) => void posted.push(runId),
    ofTask: async () => undefined,
  });

  return { posted, reactions };
};

const checked = (trial: boolean) =>
  new StackChecked(
    StackCheckId.first(STACK_ID),
    RUN_ID,
    null,
    WorkspaceId.of('ws_1'),
    true,
    trial,
  );

describe('ChangeStackReactions', () => {
  it('points the pull request at a stack once it completes or is checked', async () => {
    const { posted, reactions } = posting();

    await reactions.onCompleted(
      new ChangeStackCompleted(STACK_ID, RUN_ID, false),
    );
    await reactions.onChecked(checked(false));

    expect(posted).toEqual([RUN_ID, RUN_ID]);
  });

  it('never posts a comment for a trial’s stack, completed or checked', async () => {
    const { posted, reactions } = posting();

    await reactions.onCompleted(
      new ChangeStackCompleted(STACK_ID, RUN_ID, true),
    );
    await reactions.onChecked(checked(true));

    expect(posted).toEqual([]);
  });
});
