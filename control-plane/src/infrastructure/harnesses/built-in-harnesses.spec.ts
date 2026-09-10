import { Effort } from '@domain/value-objects/effort.vo';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { HarnessModel } from '@domain/value-objects/harness-model.vo';
import { BuiltInHarnesses } from '@infrastructure/harnesses/built-in-harnesses';
import { describe, expect, it } from 'vitest';

const known = new BuiltInHarnesses();

const claude = HarnessId.of('claude-code');
const cursor = HarnessId.of('cursor');

/** A catalogue entry by id, so a test reads what a harness is described by. */
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

  // The runner is told what to look for on its PATH, so an entry with no
  // executable is a harness nobody can ever be found to have.
  it('says what to look for on a machine', () => {
    for (const each of known.catalogue()) {
      expect(each.executable.trim()).not.toBe('');
    }
  });

  // Models are not compiled in; each harness says how a runner lists them.
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

  // Cursor carries effort on the model, so with no model there is nowhere to
  // put it and it is simply left off.
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
