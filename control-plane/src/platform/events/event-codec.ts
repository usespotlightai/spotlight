import type { EventType, EventTypes } from '@platform/events/event-types';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { isSecret } from '@shared-kernel/domain/value-objects/secret';

const TYPE = '$type';
const DATE = '$date';

type Encoded =
  | null
  | boolean
  | number
  | string
  | Encoded[]
  | { [key: string]: Encoded };

export class EventCodec {
  constructor(private readonly types: EventTypes) {}

  encode(event: DomainEvent): Encoded {
    return this.encoded(event);
  }

  decode(encoded: unknown): DomainEvent {
    return this.decoded(encoded) as DomainEvent;
  }

  private encoded(value: unknown): Encoded {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value !== 'object') {
      return value as Encoded;
    }

    if (value instanceof Date) {
      return { [DATE]: value.toISOString() };
    }

    if (isSecret(value)) {
      throw new Error(
        `${value.constructor.name} is a secret, and a secret never travels in an event`,
      );
    }

    if (Array.isArray(value)) {
      return value.map((each) => this.encoded(each));
    }

    const type = value.constructor as EventType;
    const fields: { [key: string]: Encoded } = {};

    for (const [key, each] of Object.entries(value)) {
      fields[key] = this.encoded(each);
    }

    if (type === Object) {
      return fields;
    }

    const name = this.types.nameOf(type);

    if (!name) {
      throw new Error(
        `${type.name} travels in an event but was never registered as an event type`,
      );
    }

    return { [TYPE]: name, ...fields };
  }

  private decoded(value: unknown): unknown {
    if (value === null || typeof value !== 'object') {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((each) => this.decoded(each));
    }

    const record = value as Record<string, unknown>;

    if (typeof record[DATE] === 'string') {
      return new Date(record[DATE]);
    }

    const fields: Record<string, unknown> = {};

    for (const [key, each] of Object.entries(record)) {
      if (key !== TYPE) {
        fields[key] = this.decoded(each);
      }
    }

    if (typeof record[TYPE] !== 'string') {
      return fields;
    }

    const type = this.types.named(record[TYPE]);

    if (!type) {
      throw new Error(`No event type is registered as ${record[TYPE]}`);
    }

    return Object.assign(Object.create(type.prototype), fields);
  }
}
