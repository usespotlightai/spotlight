import { madeBy, problemsIn } from '@platform/definitions/definition-schema';
import type {
  CompiledSecret,
  SecretDefinitionsPort,
} from '@secrets/application/ports/secret-definitions.port';
import {
  SECRET,
  SecretProblems,
} from '@secrets/application/rendering/secret-problems';
import { InvalidSecretError } from '@secrets/domain/exceptions/invalid-secret.error';
import { SecretBindings } from '@secrets/domain/value-objects/secret-bindings.vo';
import { SecretSource } from '@secrets/domain/value-objects/secret-source.vo';
import { SecretValue } from '@secrets/domain/value-objects/secret-value.vo';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { z } from 'zod';

const bindingSchema = z.object({
  host: z.string(),
  header: z.string().optional(),
  prefix: z.string().optional(),
});

const sourceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('built-in') }),
  z.object({
    kind: z.literal('aws-secrets-manager'),
    secretId: z.string(),
    field: z.string().nullish(),
  }),
]);

const secretSchema = z.object({
  name: madeBy(SecretName.of),
  source: sourceSchema.default({ kind: 'built-in' }),
  bindings: z.array(bindingSchema).default([]),
  valueWo: z.string({ error: 'is the value, as text' }).nullish(),
  valueWoVersion: z
    .number({ error: 'is a whole number that changes to rotate the value' })
    .int('is a whole number that changes to rotate the value')
    .min(0, 'is a whole number that changes to rotate the value')
    .nullish(),
});

export class SecretDefinitions implements SecretDefinitionsPort {
  secret(held: unknown): CompiledSecret {
    const read = secretSchema.safeParse(held);

    if (!read.success) {
      return { ok: false, problems: problemsIn(SECRET, read.error) };
    }

    try {
      const { source } = read.data;

      return {
        ok: true,
        name: SecretName.of(read.data.name),
        source:
          source.kind === 'built-in'
            ? SecretSource.builtIn()
            : SecretSource.awsSecretsManager(source),
        bindings: SecretBindings.of(read.data.bindings),
        value:
          read.data.valueWo === null || read.data.valueWo === undefined
            ? null
            : SecretValue.of(read.data.valueWo),
        valueVersion: read.data.valueWoVersion ?? null,
      };
    } catch (error) {
      if (error instanceof InvalidSecretError) {
        return { ok: false, problems: [SecretProblems.invalid(error)] };
      }

      throw error;
    }
  }
}
