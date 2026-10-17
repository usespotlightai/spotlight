import {
  hintProblems,
  orderedTypes,
  typeProblem,
} from '@integrations/infrastructure/integrations/hints';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import { describe, expect, it } from 'vitest';

const known = new Set(['Issue', 'User']);

describe('a hinted type', () => {
  it('is one a check knows, however it is nested', () => {
    for (const type of [
      'string',
      'int',
      'dyn',
      'Issue',
      'list<string>',
      'map<string, Issue>',
      'map<string, list<User>>',
    ]) {
      expect(typeProblem(type, known)).toBeNull();
    }
  });

  it('is rejected where a check does not know it, saying what it would', () => {
    expect(typeProblem('strng', known)).toMatch(/write string, int/);
    expect(typeProblem('list<Isue>', known)).toMatch(/not a type/);
    expect(typeProblem('map<double, string>', known)).toMatch(
      /map key must be string/,
    );
  });

  it('is rejected where it is written, however deep', () => {
    expect(
      hintProblems(
        { data: { issue: 'Isue', title: 'string' } },
        FieldPath.of(['webhook', 'shape']),
        known,
      ),
    ).toEqual([
      {
        at: FieldPath.of(['webhook', 'shape', 'data', 'issue']),
        reason: expect.stringMatching(/not a type/),
      },
    ]);
  });
});

describe('a file’s types', () => {
  it('are ordered each after what it names, whatever order they are written in', () => {
    expect(
      orderedTypes({
        Issue: { assignee: 'User', labels: 'list<Label>' },
        User: { email: 'string' },
        Label: { name: 'string' },
      }),
    ).toEqual({ order: ['User', 'Label', 'Issue'], cycle: null });
  });

  it('cannot be ordered where one names itself, however far round', () => {
    expect(
      orderedTypes({
        Issue: { parent: 'Epic' },
        Epic: { first: 'Issue' },
      }).cycle,
    ).not.toBeNull();
  });
});
