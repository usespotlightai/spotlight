import {
  REMOTE_VIA_GIT_PROXY,
  type RunCheckoutShape,
  type RunCommandShape,
  type RunResumeShape,
  TRACE_PARENT_VAR,
} from '@runs/application/contracts/run-spec.contract';

export interface ProxiedCheckout {
  readonly path: string;
  readonly branch: string | null;
  readonly ref: string | null;
  readonly diffOf: 'commits' | null;
  readonly setup: string | null;
}

export const RunSpecPartsMapper = {
  proxiedCheckout(checkout: ProxiedCheckout): RunCheckoutShape {
    return {
      remote: REMOTE_VIA_GIT_PROXY,
      path: checkout.path,
      ...(checkout.branch ? { branch: checkout.branch } : {}),
      ...(checkout.ref ? { ref: checkout.ref } : {}),
      ...(checkout.diffOf ? { diffOf: checkout.diffOf } : {}),
      ...(checkout.setup ? { setup: checkout.setup } : {}),
    };
  },

  resume(resume: {
    readonly session: { readonly value: string } | null;
  }): RunResumeShape {
    return resume.session ? { sessionId: resume.session.value } : {};
  },

  traced(command: RunCommandShape, traceParent: string): RunCommandShape {
    return {
      ...command,
      env: { ...command.env, [TRACE_PARENT_VAR]: traceParent },
    };
  },
};
