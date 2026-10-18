import { EventCodec } from '@platform/events/event-codec';
import { PayloadTypes } from '@platform/events/payload-types';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import {
  SECRET,
  type Secret,
} from '@shared-kernel/domain/value-objects/secret';
import { describe, expect, it } from 'vitest';

class Named {
  private constructor(readonly value: string) {}

  static of(value: string): Named {
    return new Named(value);
  }

  equals(other: Named): boolean {
    return this.value === other.value;
  }
}

class Happened implements DomainEvent {
  readonly kind = 'thing.happened';

  constructor(
    readonly who: Named,
    readonly also: readonly Named[],
    readonly at: Date,
    readonly note: string | null,
  ) {}

  get first(): Named | null {
    return this.also[0] ?? null;
  }
}

class Password implements Secret {
  get [SECRET](): true {
    return true;
  }

  constructor(readonly value: string) {}

  toJSON(): string {
    return '[secret]';
  }
}

class Leaked implements DomainEvent {
  readonly kind = 'thing.leaked';

  constructor(readonly password: Password) {}
}

class Unregistered {
  constructor(readonly value: string) {}
}

const codec = () => {
  const types = new PayloadTypes();
  types.register('test', [Named, Happened, Password, Leaked]);
  return new EventCodec(types);
};

describe('EventCodec', () => {
  it('does not carry a secret, even one registered by mistake', () => {
    expect(() => codec().encode(new Leaked(new Password('hunter2')))).toThrow(
      /secret never travels/,
    );
  });

  it('gives back the event it was given, with its value objects whole', () => {
    const at = new Date('2026-09-17T09:00:00.000Z');
    const event = new Happened(Named.of('ada'), [Named.of('grace')], at, null);

    const decoded = codec().decode(
      JSON.parse(JSON.stringify(codec().encode(event))),
    ) as Happened;

    expect(decoded).toBeInstanceOf(Happened);
    expect(decoded.kind).toBe('thing.happened');
    expect(decoded.who.equals(Named.of('ada'))).toBe(true);
    expect(decoded.first?.value).toBe('grace');
    expect(decoded.at).toEqual(at);
    expect(decoded.note).toBeNull();
  });

  it('does not carry a type nobody registered', () => {
    const event = {
      kind: 'thing.happened',
      who: new Unregistered('ada'),
    } as DomainEvent;

    expect(() => codec().encode(event)).toThrow(/never registered/);
  });

  it('rejects a payload naming a type it does not know', () => {
    expect(() =>
      codec().decode({ $type: 'Vanished', kind: 'thing.happened' }),
    ).toThrow(/No event type is registered as Vanished/);
  });
});

describe('PayloadTypes', () => {
  it('rejects two types that share a name', () => {
    const types = new PayloadTypes();
    types.register('test', [Named]);

    const Impostor = class Named {};

    expect(() => types.register('test', [Impostor])).toThrow(
      /both called Named/,
    );
  });

  it('keeps apart two contexts that name a type alike', () => {
    const types = new PayloadTypes();
    const Elsewhere = class Named {};

    types.register('one', [Named]);
    types.register('other', [Elsewhere]);

    expect(types.nameOf(Named)).toBe('one.Named');
    expect(types.named('other.Named')).toBe(Elsewhere);
  });
});
