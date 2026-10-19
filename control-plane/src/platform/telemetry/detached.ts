import { context, ROOT_CONTEXT } from '@opentelemetry/api';
import { withoutLogContext } from '@platform/logging/log-context';

export function detached<T>(work: () => T): T {
  return context.with(ROOT_CONTEXT, () => withoutLogContext(work));
}
