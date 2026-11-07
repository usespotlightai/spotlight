import { expect, it } from 'vitest';
import { ratchetProblems } from './known-violations';
import { portBindingViolations } from './port-bindings';
import { KNOWN_PORT_BINDINGS } from './port-bindings.known';

it('injects another context port only when its binding comes from upstream', () => {
  expect(ratchetProblems(portBindingViolations(), KNOWN_PORT_BINDINGS)).toEqual(
    [],
  );
}, 60_000);
