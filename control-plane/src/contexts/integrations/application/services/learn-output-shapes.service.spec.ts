import { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import {
  InMemoryLearnedOutputs,
  learningInto,
} from '@integrations/integrations.learned.fake-spec';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it, vi } from 'vitest';

const TEAM = TeamId.of('team_1');

const TOOL = ToolName.of('linear.comment');

describe('LearnOutputShapes', () => {
  it('learns what a tool answered, then merges what it answers next', async () => {
    const learned = new InMemoryLearnedOutputs();
    const learning = learningInto(learned);

    await learning.learn(TEAM, TOOL.value, { url: 'https://linear.app/c/1' });
    await learning.learn(TEAM, TOOL.value, { url: 'x', id: 'c_1' });

    const held = await learned.of(TEAM, TOOL);
    expect(held?.calls).toBe(2);
    expect(JSON.stringify(held?.shape.toJson())).not.toContain('linear.app');
  });

  it('tries again when another call learned meanwhile', async () => {
    const learned = new InMemoryLearnedOutputs();
    const save = learned.save.bind(learned);
    let raced = false;
    vi.spyOn(learned, 'save').mockImplementation(async (each) => {
      if (!raced) {
        raced = true;
        await save(each);
      }
      return save(each);
    });

    await learningInto(learned).learn(TEAM, TOOL.value, { url: 'x' });

    expect((await learned.of(TEAM, TOOL))?.calls).toBe(2);
  });

  it('never fails the call it learns from', async () => {
    const learned = new InMemoryLearnedOutputs();
    vi.spyOn(learned, 'of').mockRejectedValue(new Error('database gone'));

    await expect(
      learningInto(learned).learn(TEAM, TOOL.value, { url: 'x' }),
    ).resolves.toBeUndefined();
    await expect(
      learningInto().learn(TEAM, 'not a tool', { url: 'x' }),
    ).resolves.toBeUndefined();
  });
});
