import type { EventType, PayloadTypes } from '@platform/events/payload-types';
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

const isDomainEvent = (value: unknown): value is DomainEvent =>
  typeof value === 'object' &&
  value !== null &&
  'kind' in value &&
  typeof value.kind === 'string';

export class EventCodec {
  constructor(private readonly types: PayloadTypes) {}

  encode(event: DomainEvent): Encoded {
    return this.encoded(event);
  }

  decode(encoded: unknown): DomainEvent {
    const decoded = this.decoded(encoded);

    if (!isDomainEvent(decoded)) {
      throw new Error('An encoded event decodes to no event');
    }

    return decoded;
  }

  private encoded(value: unknown): Encoded {
    if (value === null || value === undefined) {
      return null;
    }

    if (
      typeof value === 'boolean' ||
      typeof value === 'number' ||
      typeof value === 'string'
    ) {
      return value;
    }

    if (typeof value !== 'object') {
      throw new Error(`A ${typeof value} never travels in an event`);
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

    const type: EventType = value.constructor;
    const fields: { [key: string]: Encoded } = {};

    for (const [key, each] of Object.entries(value)) {
      fields[key] = this.encoded(each);
    }

    if (type === Object) {
      return fields;
    }

    const name = this.types.nameOf(type);

    if (name === null || name === '') {
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

    const date: unknown = Reflect.get(value, DATE);

    if (typeof date === 'string') {
      return new Date(date);
    }

    const fields: Record<string, unknown> = {};

    for (const [key, each] of Object.entries(value)) {
      if (key !== TYPE) {
        fields[key] = this.decoded(each);
      }
    }

    const typeName: unknown = Reflect.get(value, TYPE);

    if (typeof typeName !== 'string') {
      return fields;
    }

    const type = this.types.named(typeName);

    if (!type) {
      throw new Error(`No event type is registered as ${typeName}`);
    }

    return Object.assign(Object.create(type.prototype), fields);
  }
}
