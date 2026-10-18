import { InvalidTrustedWorkloadError } from '@runners/domain/exceptions/invalid-trusted-workload.error';
import { TrustedWorkload } from '@runners/domain/value-objects/trusted-workload.vo';
import { describe, expect, it } from 'vitest';

describe('TrustedWorkload', () => {
  it('takes an https issuer exactly as written', () => {
    expect(
      TrustedWorkload.issuerOf(
        'https://oidc.eks.eu-west-1.amazonaws.com/id/ABC',
      ),
    ).toBe('https://oidc.eks.eu-west-1.amazonaws.com/id/ABC');
  });

  it('takes a plain http issuer only on this machine', () => {
    expect(TrustedWorkload.issuerOf('http://127.0.0.1:8080')).toBe(
      'http://127.0.0.1:8080',
    );
    expect(() => TrustedWorkload.issuerOf('http://issuer.example.com')).toThrow(
      InvalidTrustedWorkloadError,
    );
  });

  it('rejects an issuer carrying a query or credentials', () => {
    for (const raw of [
      'https://issuer.example.com?x=1',
      'https://user:pass@issuer.example.com',
      'not a url',
    ]) {
      expect(() => TrustedWorkload.issuerOf(raw)).toThrow(
        InvalidTrustedWorkloadError,
      );
    }
  });

  it('rejects a subject with spaces in it', () => {
    expect(() => TrustedWorkload.subjectOf('two words')).toThrow(
      InvalidTrustedWorkloadError,
    );
  });
});
