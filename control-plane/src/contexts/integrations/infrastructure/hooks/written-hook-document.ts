import type {
  WrittenHookDocument,
  WrittenHookSigning,
  WrittenHookStep,
} from '@integrations/application/ports/hook-resources.port';
import {
  type WrittenHook,
  writtenHookOf,
} from '@integrations/infrastructure/hooks/hook.compile';
import type { HookStepFile } from '@integrations/infrastructure/hooks/hook.schema';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

const stepOf = (step: HookStepFile): WrittenHookStep => {
  if (step.call !== undefined) {
    return { name: step.name, call: step.call, with: { ...step.with } };
  }

  const request = step.request as NonNullable<HookStepFile['request']>;

  return {
    name: step.name,
    request: {
      url: request.url,
      headers: { ...request.headers },
      body: request.body,
      from: request.from ?? null,
    },
  };
};

const signingOf = (
  signing: WrittenHook['signing'],
): WrittenHookSigning | null => {
  if (!signing) {
    return null;
  }

  return 'oidc' in signing
    ? { oidc: { audience: signing.oidc.audience } }
    : { secretVersion: signing.secretVersion };
};

export const writtenHookDocumentOf = (
  key: string,
  stored: unknown,
): WrittenHookDocument => {
  const written = writtenHookOf(stored);

  if (!written) {
    throw new InconsistentStateError(
      'hook',
      `${key} is stored in a form no hook is written in`,
    );
  }

  return {
    on: written.on,
    match: {
      tools: [...written.match.tools],
      lines: [...written.match.lines],
      stations: [...written.match.stations],
      repositories: [...written.match.repositories],
      paths: [...written.match.paths],
    },
    when: written.when ?? null,
    vars: { ...written.vars },
    steps: written.steps.map(stepOf),
    signing: signingOf(written.signing),
    failure: written.failure,
    timeoutSeconds: written.timeoutSeconds,
  };
};
