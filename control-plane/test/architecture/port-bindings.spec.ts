import { expect, it } from 'vitest';

import { portBindingViolations } from './port-bindings';
import { described } from './violation';

it('injects another context port only when its binding comes from upstream', () => {
  expect(described(portBindingViolations())).toEqual([]);
}, 60_000);
