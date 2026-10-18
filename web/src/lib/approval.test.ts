import { describe, expect, it } from 'vitest';
import {
  type Approval,
  approvedOnlyBy,
  askedFor,
  blanked,
  changedNames,
  copyText,
  differs,
  editable,
  labelOf,
  readsAsCode,
  shownInputs,
  titleOf,
} from '@/lib/approval';

const COMMENT: Approval = {
  kind: 'tool-call',
  name: 'linear.comment',
  because: 'It posts publicly, under the team’s name.',
  inputs: [
    { name: 'body', value: 'Fixed.' },
    { name: 'issue', value: 'ENG-12' },
  ],
  status: 'pending',
  edited: null,
  intent: null,
  askedOf: null,
};

const EXECUTE: Approval = {
  kind: 'harness-permission',
  name: 'claude-code execute',
  because: 'The harness asked before doing it.',
  inputs: [
    { name: 'title', value: 'kubectl logs deploy/api --since=1h' },
    {
      name: 'input',
      value: '{"command":"kubectl logs deploy/api --since=1h"}',
    },
  ],
  status: 'pending',
  edited: null,
  intent: null,
  askedOf: null,
};

describe('approval', () => {
  it('names who alone can approve a call asked of someone else', () => {
    const alice = { ...COMMENT, askedOf: { id: 'user_alice', name: 'Alice' } };

    expect(approvedOnlyBy(alice, 'user_bob')).toBe('Alice');
    expect(approvedOnlyBy(alice, 'user_alice')).toBeNull();
    expect(approvedOnlyBy(COMMENT, 'user_bob')).toBeNull();
  });

  it('lets a tool call be changed, never what a harness asked', () => {
    expect(editable(COMMENT)).toBe(true);
    expect(editable(EXECUTE)).toBe(false);
    expect(editable({ ...COMMENT, inputs: [] })).toBe(false);
  });

  it('reads a command as code, and words as words', () => {
    expect(readsAsCode(EXECUTE, { name: 'title', value: 'ls' })).toBe(true);
    expect(
      readsAsCode(
        { ...EXECUTE, name: 'claude-code edit' },
        { name: 'title', value: 'Edit src/queue.ts' },
      ),
    ).toBe(false);
    expect(readsAsCode(COMMENT, { name: 'body', value: 'Fixed.' })).toBe(false);
    expect(readsAsCode(COMMENT, { name: 'command', value: 'ls' })).toBe(true);
  });

  it('reads a structured value a tool takes as code', () => {
    expect(
      readsAsCode(COMMENT, {
        name: 'input',
        value: '{\n  "title": "Broken"\n}',
      }),
    ).toBe(true);
    expect(readsAsCode(COMMENT, { name: 'labels', value: '["bug"]' })).toBe(
      true,
    );
    expect(readsAsCode(COMMENT, { name: 'body', value: '{not json' })).toBe(
      false,
    );
    expect(readsAsCode(COMMENT, { name: 'count', value: '3' })).toBe(false);
  });

  it('names no label over what a harness says it would do', () => {
    expect(labelOf(EXECUTE, { name: 'title', value: 'ls' })).toBeNull();
    expect(labelOf(COMMENT, { name: 'body', value: 'Fixed.' })).toBe('body');
  });

  it('shows what it was approved to run with, and which inputs the person changed', () => {
    const edited = {
      ...COMMENT,
      status: 'approved' as const,
      edited: [
        { name: 'body', value: 'Fixed in #41.' },
        { name: 'issue', value: 'ENG-12' },
      ],
    };

    expect(shownInputs(edited)).toBe(edited.edited);
    expect([...changedNames(edited)]).toEqual(['body']);
    expect(changedNames(COMMENT).size).toBe(0);
  });

  it('tells a change from leaving every input as it was', () => {
    expect(differs(COMMENT.inputs, { body: 'Fixed.', issue: 'ENG-12' })).toBe(
      false,
    );
    expect(differs(COMMENT.inputs, { body: 'Done.', issue: 'ENG-12' })).toBe(
      true,
    );
  });

  it('tells an input left blank, where it was asked with a value', () => {
    expect(blanked(COMMENT.inputs, { body: ' ' })).toBe(true);
    expect(blanked(COMMENT.inputs, { body: 'Done.' })).toBe(false);
    expect(blanked([{ name: 'note', value: '' }], { note: '' })).toBe(false);
  });

  it('says what Spotlight would like to do, in the agent’s words where it gave them', () => {
    expect(askedFor({ ...COMMENT, intent: 'post the fix on ENG-12' })).toBe(
      'Spotlight would like to post the fix on ENG-12.',
    );
    expect(askedFor({ ...COMMENT, intent: 'post it…' })).toBe(
      'Spotlight would like to post it…',
    );
    expect(
      askedFor({
        ...COMMENT,
        intent: 'post the fix on ENG-12',
        status: 'approved',
        edited: [{ name: 'body', value: 'Done.' }],
      }),
    ).toBe('Spotlight asked to post the fix on ENG-12. You edited its inputs.');
    expect(askedFor(COMMENT)).toBe(
      'Spotlight would like to use linear.comment. It posts publicly, under the team’s name.',
    );
  });

  it('titles an approval by its status', () => {
    expect(titleOf(COMMENT)).toBe('Waiting for your approval');
    expect(titleOf({ ...COMMENT, status: 'approved' })).toBe(
      'Request approved',
    );
    expect(
      titleOf({
        ...COMMENT,
        status: 'approved',
        edited: [{ name: 'body', value: 'Done.' }],
      }),
    ).toBe('Request approved with changes');
    expect(titleOf({ ...COMMENT, status: 'dismissed' })).toBe(
      'Request dismissed',
    );
  });

  it('copies the command alone, one input as itself, and several by name', () => {
    expect(copyText(EXECUTE)).toBe('kubectl logs deploy/api --since=1h');
    expect(
      copyText({ ...COMMENT, inputs: [{ name: 'body', value: 'Fixed.' }] }),
    ).toBe('Fixed.');
    expect(copyText(COMMENT)).toBe('body: Fixed.\nissue: ENG-12');
  });
});
