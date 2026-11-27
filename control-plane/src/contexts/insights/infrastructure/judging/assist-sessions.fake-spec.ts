import type {
  AssistOrder,
  AssistSessionsPort,
  AssistState,
} from '@assist/application/ports/assist-sessions.port';
import type { JsonValue } from '@shared-kernel/domain/json-value';

const WAITING: AssistState = { status: 'waiting', since: new Date(0) };

const sessionOf = (order: Pick<AssistOrder, 'purpose' | 'key'>): string =>
  `${order.purpose}#${order.key}`;

/**
 * Orders a session the first time a (purpose, key) is seen and reports each session's own state afterwards, the way
 * the assist context does. A session nobody settled reports the fallback state.
 */
export class FakeAssistSessions implements AssistSessionsPort {
  /** The first order of each session, in the order they came. */
  readonly orders: AssistOrder[] = [];

  readonly #states = new Map<string, AssistState>();

  constructor(public fallback: AssistState = WAITING) {}

  /** Settles one session; the others keep reporting the fallback state. */
  settle(
    order: Pick<AssistOrder, 'purpose' | 'key'>,
    state: AssistState,
  ): void {
    this.#states.set(sessionOf(order), state);
  }

  request(order: AssistOrder): Promise<AssistState> {
    const session = sessionOf(order);

    if (!this.orders.some((each) => sessionOf(each) === session)) {
      this.orders.push(order);
    }

    return Promise.resolve(this.#states.get(session) ?? this.fallback);
  }
}

export const submitted = (
  result: JsonValue,
  model = 'claude-code/claude-sonnet-4-5',
): AssistState => ({
  status: 'submitted',
  result,
  usage: null,
  model,
});
