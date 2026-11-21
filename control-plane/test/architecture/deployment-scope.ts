import ts from 'typescript';

import { descendants, type SourceFile, sourceFiles } from './source-index';
import type { Violation } from './violation';

// OutboundScope.deployment drops the allow-list of every workspace. Only the platform calls it, for a URL that the deployment sets.
export const deploymentScopeIn = (file: SourceFile): Violation[] =>
  file.path.startsWith('platform/')
    ? []
    : descendants(file.tree, ts.isCallExpression)
        .filter(
          (call) =>
            ts.isPropertyAccessExpression(call.expression) &&
            call.expression.name.text === 'deployment' &&
            call.expression.expression.getText() === 'OutboundScope',
        )
        .map((call) => ({
          key: `${file.path}: calls OutboundScope.deployment, which only the platform may call`,
          at: `${file.path}:${file.tree.getLineAndCharacterOfPosition(call.getStart()).line + 1}`,
        }));

export const deploymentScopeViolations = (): Violation[] =>
  sourceFiles().flatMap(deploymentScopeIn);
