import { Credential } from '@secrets/application/contracts/credential.contract';
import {
  InjectedSecrets,
  type SecretInjectionTarget,
} from '@secrets/application/contracts/injected-secrets.contract';

export const injectedSecretsOf = (
  injected: readonly (SecretInjectionTarget & {
    readonly value: string;
    readonly bare: string;
  })[],
): InjectedSecrets =>
  InjectedSecrets.of(
    injected.map((each) => ({
      location: each.location,
      name: each.name,
      value: Credential.of(each.value),
      bare: Credential.of(each.bare),
    })),
  );
