import { ChangeStackReactions } from '@change-review/application/events/handlers/change-stack-reactions.handler';
import { ChangeStackChecked } from '@change-review/domain/events/change-stack-checked.event';
import { ChangeStackSettled } from '@change-review/domain/events/change-stack-settled.event';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const STACK_ID = ChangeStackId.of('stack-1');
const RUN_ID = RunId.of('run-1');

const announcing = () => {
  const announced: RunId[] = [];
  const reactions = new ChangeStackReactions({
    ofRun: async (runId) => void announced.push(runId),
    ofTask: async () => undefined,
  });

  return { announced, reactions };
};

const checked = (replay: boolean) =>
  new ChangeStackChecked(
    STACK_ID,
    RUN_ID,
    null,
    WorkspaceId.of('ws_1'),
    true,
    replay,
  );

describe('ChangeStackReactions', () => {
  it('points the pull request at a stack once it settles or is checked', async () => {
    const { announced, reactions } = announcing();

    await reactions.onSettled(new ChangeStackSettled(STACK_ID, RUN_ID, false));
    await reactions.onChecked(checked(false));

    expect(announced).toEqual([RUN_ID, RUN_ID]);
  });

  it('never announces a replay’s stack, settled or checked', async () => {
    const { announced, reactions } = announcing();

    await reactions.onSettled(new ChangeStackSettled(STACK_ID, RUN_ID, true));
    await reactions.onChecked(checked(true));

    expect(announced).toEqual([]);
  });
});
