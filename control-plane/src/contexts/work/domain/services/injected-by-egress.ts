import { distinct } from '@shared-kernel/domain/services/distinct';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';

export interface InjectedByEgress {
  readonly env: Readonly<Record<string, string>>;
  readonly injectedSecrets: readonly SecretName[];
}

const placeholderFor = (secret: SecretName): string =>
  `spotlight-egress:${secret.value}`;

export const injectedByEgress = (
  env: Readonly<Record<string, string>>,
): InjectedByEgress => {
  const injected: SecretName[] = [];

  const written = Object.fromEntries(
    Object.entries(env).map(([name, value]) => {
      const secret = SecretName.referencedBy(value);

      if (!secret) {
        return [name, value];
      }

      injected.push(secret);
      return [name, placeholderFor(secret)];
    }),
  );

  return {
    env: written,
    injectedSecrets: distinct(injected),
  };
};
