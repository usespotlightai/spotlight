import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { HarnessModel } from '@shared-kernel/domain/value-objects/harness-model.vo';
import { Effort } from '@work/domain/value-objects/effort.vo';
import { BuiltInHarnesses } from '@work/infrastructure/harnesses/built-in-harnesses';
import { describe, expect, it } from 'vitest';

const known = new BuiltInHarnesses();

const claude = HarnessId.of('claude-code');
const cursor = HarnessId.of('cursor');

const entry = (id: string) => known.catalogue().find((each) => each.id === id);

describe('the harnesses Spotlight knows', () => {
  it('finds one by the name it is known under', () => {
    expect(known.named(claude)?.name.value).toBe('Claude Code');
  });

  it('knows nothing of a harness it was never taught', () => {
    expect(known.named(HarnessId.of('nothing-of-the-sort'))).toBeNull();
    expect(known.commandFor(HarnessId.of('nothing'), null_())).toBeNull();
  });

  it('holds no two harnesses under one name', () => {
    const named = known.all().map((harness) => harness.id.value);

    expect(new Set(named).size).toBe(named.length);
  });

  it('knows Cursor as well as Claude Code', () => {
    expect(known.named(cursor)?.name.value).toBe('Cursor CLI');
  });

  it('says what to look for on a machine', () => {
    for (const each of known.catalogue()) {
      expect(each.executable.trim()).not.toBe('');
    }
  });

  it('gives each harness a way to discover its models', () => {
    for (const each of known.catalogue()) {
      expect(each.discovery.length).toBeGreaterThan(0);
    }
  });

  it('offers an effort ladder for each harness', () => {
    for (const each of known.catalogue()) {
      expect(each.efforts.length).toBeGreaterThan(0);
    }
  });

  it('tells Claude Code its model and effort through the environment', () => {
    const started = known
      .commandFor(claude, {
        model: HarnessModel.of('claude-opus-4-8'),
        effort: Effort.of('high'),
      })
      ?.started();

    expect(started?.env?.ANTHROPIC_MODEL).toBe('claude-opus-4-8');
    expect(started?.env?.CLAUDE_CODE_EFFORT_LEVEL).toBe('high');
    expect(started?.executable).toBe('claude-agent-acp');
  });

  it('folds Cursor’s effort into the model it is given', () => {
    const started = known
      .commandFor(cursor, {
        model: HarnessModel.of('gpt-5'),
        effort: Effort.of('high'),
      })
      ?.started();

    expect(started?.executable).toBe('cursor-agent');
    expect(started?.args).toEqual(['acp', '--model', 'gpt-5[effort=high]']);
  });

  it('leaves Cursor’s effort off when no model is chosen', () => {
    const started = known
      .commandFor(cursor, { model: null, effort: Effort.of('high') })
      ?.started();

    expect(started?.args).toEqual(['acp']);
  });

  it('imposes nothing when neither model nor effort is chosen', () => {
    const started = known.commandFor(claude, null_())?.started();

    expect(started?.env?.ANTHROPIC_MODEL).toBeUndefined();
    expect(started?.env?.CLAUDE_CODE_EFFORT_LEVEL).toBeUndefined();
  });

  it('describes what each harness offers', () => {
    expect(entry('claude-code')?.efforts).toContain('high');
    expect(entry('cursor')?.discovery).toEqual(['cursor-agent', 'models']);
  });
});

const null_ = () => ({ model: null, effort: null });

describe('where a harness finds skills', () => {
  const harnesses = new BuiltInHarnesses();

  it('lays them where Claude Code reads project skills itself', () => {
    expect(harnesses.skillsFor(HarnessId.of('claude-code'))).toEqual({
      directory: '.claude/skills',
      readByHarness: true,
    });
  });

  it('lays them beside Spotlight’s own for a harness not known to read them', () => {
    expect(harnesses.skillsFor(HarnessId.of('cursor'))).toEqual({
      directory: '.spotlight/skills',
      readByHarness: false,
    });
  });

  it('says nothing for a harness it does not know', () => {
    expect(harnesses.skillsFor(HarnessId.of('teleport'))).toBeNull();
  });
});
