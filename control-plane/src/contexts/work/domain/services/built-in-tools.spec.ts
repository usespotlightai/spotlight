import {
  builtInToolsForChat,
  PROPOSE_TASK,
  SETUP_PULL_REQUEST,
} from '@work/domain/services/built-in-tools';
import { describe, expect, it } from 'vitest';

const offered = (settingUp: boolean) =>
  builtInToolsForChat(settingUp).map((each) => each.declared.tool.value);

describe('the tools Spotlight gives a chat', () => {
  it('let any chat propose a task', () => {
    expect(offered(false)).toContain(PROPOSE_TASK.value);
    expect(offered(true)).toContain(PROPOSE_TASK.value);
  });

  it('let only a setup chat open the setup pull request', () => {
    expect(offered(false)).not.toContain(SETUP_PULL_REQUEST.value);
    expect(offered(true)).toContain(SETUP_PULL_REQUEST.value);
  });
});
