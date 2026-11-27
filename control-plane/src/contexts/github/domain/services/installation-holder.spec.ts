import { isHeldElsewhere } from '@github/domain/services/installation-holder';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const HERE = WorkspaceId.of('ws_1');
const ELSEWHERE = WorkspaceId.of('ws_2');

describe('isHeldElsewhere', () => {
  it('holds an installation that another workspace uses', () => {
    expect(isHeldElsewhere(ELSEWHERE, HERE)).toBe(true);
  });

  it('frees an installation that no workspace uses', () => {
    expect(isHeldElsewhere(null, HERE)).toBe(false);
  });

  it('frees an installation that this workspace already uses', () => {
    expect(isHeldElsewhere(HERE, HERE)).toBe(false);
  });
});
