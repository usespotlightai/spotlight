import { expect, it } from 'vitest';

import { portBindings, portBindingViolations } from './port-bindings';
import { described } from './violation';

it('injects another context port only when its binding comes from upstream', () => {
  expect(described(portBindingViolations())).toEqual([]);
}, 60_000);

it('checks the assist sessions port that insights, change review and memory inject', () => {
  const assist = portBindings().filter((each) =>
    each.token.endsWith('assist-sessions.port#ASSIST_SESSIONS'),
  );

  expect(
    [
      ...new Set(assist.map((each) => `${each.consumer} ← ${each.provider}`)),
    ].sort(),
  ).toEqual(['change-review ← assist', 'insights ← assist', 'memory ← assist']);
}, 60_000);
