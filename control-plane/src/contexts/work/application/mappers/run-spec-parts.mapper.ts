import {
  REMOTE_VIA_GIT_PROXY,
  type RunCheckoutShape,
  type RunCommandShape,
  type RunResumeShape,
  type RunSpecShape,
  TRACE_PARENT_VAR,
} from '@runs/application/contracts/run-spec.contract';
import type { OrderedHandover } from '@work/domain/services/run-order';

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
      ...(checkout.branch ? { branch: checkout.branch } : {}),
      ...(checkout.base ? { base: checkout.base } : {}),
      ...(checkout.ref ? { ref: checkout.ref } : {}),
      ...(checkout.diffOf ? { diffOf: checkout.diffOf } : {}),
      ...(checkout.setup ? { setup: checkout.setup } : {}),
    };
  },

  handover({
    options,
    resumeOptions,
    noteLimit,
  }: OrderedHandover): RunSpecShape['handover'] {
    return {
      options: options.map((each) => each.word),
      ...(resumeOptions.length > 0
        ? { resumeOptions: resumeOptions.map((each) => each.word) }
        : {}),
      noteLimit,
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
      ...(followUp ? { followUp } : {}),
    };
  },

  traced(command: RunCommandShape, traceParent: string): RunCommandShape {
    return {
      ...command,
      env: { ...command.env, [TRACE_PARENT_VAR]: traceParent },
    };
  },
};
