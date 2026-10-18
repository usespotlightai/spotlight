import { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import {
  InMemoryInferredOutputSchemas,
  inferringInto,
} from '@integrations/integrations.inferred.fake-spec';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it, vi } from 'vitest';

const TEAM = TeamId.of('team_1');

const TOOL = ToolName.of('linear.comment');

describe('InferOutputSchemas', () => {
  it('infers what a tool answered, then merges what it answers next', async () => {
    const schemas = new InMemoryInferredOutputSchemas();
    const inferring = inferringInto(schemas);

    await inferring.infer(TEAM, TOOL.value, { url: 'https://linear.app/c/1' });
    await inferring.infer(TEAM, TOOL.value, { url: 'x', id: 'c_1' });

    const output = await schemas.of(TEAM, TOOL);
    expect(output?.calls).toBe(2);
    expect(JSON.stringify(output?.shape.toJson())).not.toContain('linear.app');
  });

  it('tries again when another call inferred a schema at the same time', async () => {
    const schemas = new InMemoryInferredOutputSchemas();
    const save = schemas.save.bind(schemas);
    let raced = false;
    vi.spyOn(schemas, 'save').mockImplementation(async (each) => {
      if (!raced) {
        raced = true;
        await save(each);
      }
      return save(each);
    });

    await inferringInto(schemas).infer(TEAM, TOOL.value, { url: 'x' });

    expect((await schemas.of(TEAM, TOOL))?.calls).toBe(2);
  });

  it('never fails the call it infers from', async () => {
    const schemas = new InMemoryInferredOutputSchemas();
    vi.spyOn(schemas, 'of').mockRejectedValue(new Error('database gone'));

    await expect(
      inferringInto(schemas).infer(TEAM, TOOL.value, { url: 'x' }),
    ).resolves.toBeUndefined();
    await expect(
      inferringInto().infer(TEAM, 'not a tool', { url: 'x' }),
    ).resolves.toBeUndefined();
  });
});
