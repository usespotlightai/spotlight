import { Branch } from '@work/domain/value-objects/branch.vo';
import { CorrelationKeys } from '@work/domain/value-objects/correlation-keys.vo';
import { Mark } from '@work/domain/value-objects/mark.vo';
import { describe, expect, it } from 'vitest';

const ISSUE = Mark.of('linear.issue', 'ENG-42');

describe('CorrelationKeys', () => {
  it('carries the branch a source named', () => {
    expect(
      CorrelationKeys.of({ branch: 'feat/add-a-menu-0a1b2c3d' })?.branch,
    ).toEqual(Branch.of('feat/add-a-menu-0a1b2c3d'));
  });

  it('carries every handle the source recognised', () => {
    expect(CorrelationKeys.of({ marks: [ISSUE] })?.marks).toEqual([ISSUE]);
  });

  it('keeps only the handles there were', () => {
    expect(CorrelationKeys.of({ marks: [null, ISSUE, null] })?.marks).toEqual([
      ISSUE,
    ]);
  });

  it('is nothing where it names neither a branch nor a handle', () => {
    expect(CorrelationKeys.of({})).toBeNull();
    expect(CorrelationKeys.of({ branch: ' ' })).toBeNull();
    expect(CorrelationKeys.of({ marks: [null] })).toBeNull();
  });
});
