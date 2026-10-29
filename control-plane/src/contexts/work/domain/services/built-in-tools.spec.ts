import {
  builtInToolsForChat,
  PROPOSE_TASK,
  SETUP_PULL_REQUEST,
  TEST_STATION_CHANGE,
} from '@work/domain/services/built-in-tools';
import { describe, expect, it } from 'vitest';

const offered = (chat: { settingUp?: boolean; improving?: boolean } = {}) =>
  builtInToolsForChat({
    settingUp: chat.settingUp ?? false,
    improving: chat.improving ?? false,
  }).map((each) => each.declared.tool.value);

describe('the tools Spotlight enables for a chat', () => {
  it('let any chat propose a task', () => {
    expect(offered()).toContain(PROPOSE_TASK.value);
    expect(offered({ settingUp: true })).toContain(PROPOSE_TASK.value);
  });

  it('let only a setup chat open the setup pull request', () => {
    expect(offered()).not.toContain(SETUP_PULL_REQUEST.value);
    expect(offered({ settingUp: true })).toContain(SETUP_PULL_REQUEST.value);
  });

  it('let only a chat that improves a station test a change to it', () => {
    expect(offered()).not.toContain(TEST_STATION_CHANGE.value);
    expect(offered({ improving: true })).toContain(TEST_STATION_CHANGE.value);
  });
});
