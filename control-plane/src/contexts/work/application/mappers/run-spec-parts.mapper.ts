import {
  REMOTE_VIA_GIT_PROXY,
  type RunCheckoutShape,
  type RunCommandShape,
  type RunResumeShape,
  TRACE_PARENT_VAR,
} from '@runs/application/contracts/run-spec.contract';
import { nonEmpty } from '@shared-kernel/domain/non-empty';

export interface ProxiedCheckout {
  readonly path: string;
  readonly branch: string | null;
  readonly base?: string | null;
  readonly ref: string | null;
  readonly diffOf: 'commits' | null;
  readonly setup: string | null;
}

export const RunSpecPartsMapper = {
  proxiedCheckout(checkout: ProxiedCheckout): RunCheckoutShape {
    return {
      remote: REMOTE_VIA_GIT_PROXY,
      path: checkout.path,
      ...(nonEmpty(checkout.branch) ? { branch: checkout.branch } : {}),
      ...(nonEmpty(checkout.base) ? { base: checkout.base } : {}),
      ...(nonEmpty(checkout.ref) ? { ref: checkout.ref } : {}),
      ...(checkout.diffOf ? { diffOf: checkout.diffOf } : {}),
      ...(nonEmpty(checkout.setup) ? { setup: checkout.setup } : {}),
    };
  },

  resume(
    resume: { readonly session: { readonly value: string } | null },
    followUp: string | null = null,
  ): RunResumeShape {
    if (!resume.session) {
      return {};
    }

    return {
      sessionId: resume.session.value,
      ...(nonEmpty(followUp) ? { followUp } : {}),
    };
  },

  traced(command: RunCommandShape, traceParent: string): RunCommandShape {
    return {
      ...command,
      env: { ...command.env, [TRACE_PARENT_VAR]: traceParent },
    };
  },
};
