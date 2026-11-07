import { TerraformLockBody } from '@configuration/application/mappers/terraform-lock-body.mapper';
import { InvalidTerraformStateError } from '@configuration/domain/exceptions/invalid-terraform-state.error';
import { PrincipalRef } from '@configuration/domain/value-objects/principal-ref.vo';
import { describe, expect, it } from 'vitest';

describe('TerraformLockBody', () => {
  const at = new Date('2026-10-26T10:00:00Z');
  const by = PrincipalRef.rehydrate('person:u1');

  it('keeps the lock info Terraform sent and reads its ID and operation', () => {
    const info = { ID: 'a', Operation: 'OperationTypePlan', Who: 'me@laptop' };
    const lock = TerraformLockBody.lockOf(info, by, at);

    expect(lock.asWritten).toEqual(info);
    expect(lock.id.value).toBe('a');
    expect(lock.operation).toBe('OperationTypePlan');
  });

  it.each([
    ['not an object', 'a'],
    ['no ID', { Operation: 'OperationTypePlan' }],
    ['an empty ID', { ID: ' ' }],
  ])('refuses lock info with %s', (_, info) => {
    expect(() => TerraformLockBody.lockOf(info, by, at)).toThrow(
      InvalidTerraformStateError,
    );
    expect(() => TerraformLockBody.idIn(info)).toThrow(
      InvalidTerraformStateError,
    );
  });
});
