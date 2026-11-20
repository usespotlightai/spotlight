import { SecretValueOrigin } from '@secrets/domain/value-objects/secret-value-origin.vo';
import { describe, expect, it } from 'vitest';

describe('SecretValueOrigin', () => {
  it('awaits a value that neither Terraform nor a person set yet', () => {
    const origin = SecretValueOrigin.of({
      valueVersion: null,
      holdsValue: false,
    });

    expect([origin.kind, origin.awaitsValue, origin.settable]).toEqual([
      'awaiting',
      true,
      true,
    ]);
  });

  it('is Spotlight’s own once Terraform hands the value over or a person sets it', () => {
    const origin = SecretValueOrigin.of({
      valueVersion: null,
      holdsValue: true,
    });

    expect([origin.kind, origin.settable]).toEqual(['spotlight', true]);
  });

  it('comes from Terraform while a value version is set', () => {
    const origin = SecretValueOrigin.of({ valueVersion: 3, holdsValue: true });

    expect([origin.kind, origin.settable]).toEqual(['terraform', false]);
  });
});
