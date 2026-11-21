import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import {
  deploymentScopeIn,
  deploymentScopeViolations,
} from './deployment-scope';
import { described } from './violation';

const problemsIn = (path: string, source: string): string[] =>
  deploymentScopeIn({
    path,
    tree: ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true),
  }).map((violation) => violation.key.replace(`${path}: `, ''));

const CALL = `import { OutboundScope } from '@platform/outbound/outbound-scope';
  OutboundScope.deployment(() => fetch(url));`;

describe('deployment outbound scope', () => {
  it('finds a context that leaves the allow-list of its workspace', () => {
    expect(
      problemsIn('contexts/integrations/infrastructure/fixture.ts', CALL),
    ).toEqual([
      'calls OutboundScope.deployment, which only the platform may call',
    ]);
  });

  it('lets the platform call it', () => {
    expect(problemsIn('platform/events/fixture.ts', CALL)).toEqual([]);
  });

  it('is called only in the platform', () => {
    expect(described(deploymentScopeViolations())).toEqual([]);
  }, 60_000);
});
