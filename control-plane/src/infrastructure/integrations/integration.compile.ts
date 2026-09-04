import { DeclaredHappening } from '@domain/entities/declared-happening.entity';
import { Integration } from '@domain/entities/integration.entity';
import { ConfigurationProblem } from '@domain/value-objects/configuration-problem.vo';
import { Happening } from '@domain/value-objects/happening.vo';
import { MarkKind } from '@domain/value-objects/mark-kind.vo';
import { SecretName } from '@domain/value-objects/secret-name.vo';
import { Signing } from '@domain/value-objects/signing.vo';
import { SourceKey } from '@domain/value-objects/source-key.vo';
import {
  compile as compileExpression,
  type Expression,
  ExpressionError,
} from '@infrastructure/integrations/expression';
import {
  integrationSchema,
  written,
} from '@infrastructure/integrations/integration.schema';
import { parse as parseYaml } from 'yaml';

/** How one word is told apart from the rest of a host's deliveries. */
export interface HappeningRules {
  readonly happening: string;
  readonly when: Expression;
  readonly branch: Expression | null;
  readonly marks: readonly { kind: MarkKind; value: Expression }[];
}

/** The rules travel beside the integration rather than inside it. */
export interface ReadableIntegration {
  readonly integration: Integration;
  readonly delivery: Expression | null;
  readonly rules: readonly HappeningRules[];
}

export type Compiled =
  | { readonly ok: true; readonly readable: ReadableIntegration }
  | { readonly ok: false; readonly problems: readonly ConfigurationProblem[] };

const reasoned = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** One expression, named by where in the file it sits. */
const expressionAt = (
  held: string,
  at: string,
  problems: ConfigurationProblem[],
  path: string,
): Expression | null => {
  try {
    return compileExpression(written(held));
  } catch (error) {
    problems.push(
      ConfigurationProblem.of({
        path,
        at,
        reason:
          error instanceof ExpressionError ? error.message : reasoned(error),
      }),
    );

    return null;
  }
};

/**
 * Expressions are parsed here so nothing fails on a Sunday; the words go to
 * the domain, which says whether they are a vocabulary at all.
 */
export const compileIntegration = (path: string, text: string): Compiled => {
  const problems: ConfigurationProblem[] = [];

  let held: unknown;

  try {
    held = parseYaml(text);
  } catch (error) {
    return {
      ok: false,
      problems: [
        ConfigurationProblem.of({
          path,
          at: 'the file',
          reason: `is not YAML: ${reasoned(error)}`,
        }),
      ],
    };
  }

  const read = integrationSchema.safeParse(held);

  if (!read.success) {
    return {
      ok: false,
      problems: read.error.issues.map((issue) =>
        ConfigurationProblem.of({
          path,
          at: issue.path.length > 0 ? issue.path.join('.') : 'the file',
          reason: issue.message,
        }),
      ),
    };
  }

  const file = read.data;

  const delivery = file.delivery
    ? expressionAt(file.delivery, 'delivery', problems, path)
    : null;

  // Asked of the domain, and asked here as well as there: the aggregate
  // refuses the whole file, while this can point at the line.
  const source = SourceKey.of(file.source);

  const rules = file.happenings.map((raising, at) => {
    const where = `happenings.${at}`;

    if (!source.raises({ source: Happening.of(raising.happening).source })) {
      problems.push(
        ConfigurationProblem.of({
          path,
          at: `${where}.happening`,
          reason: `must begin with ${file.source}., because that is the source raising it`,
        }),
      );
    }

    if (!raising.concerns.branch && raising.concerns.marks.length === 0) {
      problems.push(
        ConfigurationProblem.of({
          path,
          at: `${where}.concerns`,
          reason:
            'needs a branch or a mark, or nothing could find a task from it',
        }),
      );
    }

    return {
      happening: raising.happening,
      when: expressionAt(raising.when, `${where}.when`, problems, path),
      branch: raising.concerns.branch
        ? expressionAt(
            raising.concerns.branch,
            `${where}.concerns.branch`,
            problems,
            path,
          )
        : null,
      marks: raising.concerns.marks.map((mark, index) => ({
        kind: mark.kind,
        value: expressionAt(
          mark.value,
          `${where}.concerns.marks.${index}.value`,
          problems,
          path,
        ),
      })),
    };
  });

  if (problems.length > 0) {
    return { ok: false, problems };
  }

  // The domain has the last word on whether these are a vocabulary. What it
  // refuses comes back as a problem with the file, because that is what it is.
  try {
    const integration = Integration.of({
      source,
      name: file.name,
      signing: Signing.of({
        scheme: file.verify.scheme,
        header: file.verify.header,
        secret: SecretName.of(file.verify.secret),
        encoding: file.verify.encoding,
        prefix: file.verify.prefix,
      }),
      declares: file.happenings.map((raising) =>
        DeclaredHappening.of({
          happening: Happening.of(raising.happening),
          label: raising.label,
          told: raising.told,
          spoken: raising.spoken,
          finds: raising.concerns.marks.map((mark) => MarkKind.of(mark.kind)),
          findsByBranch: raising.concerns.branch !== undefined,
        }),
      ),
    });

    return {
      ok: true,
      readable: {
        integration,
        delivery,
        rules: rules.map((rule) => ({
          happening: rule.happening,
          when: rule.when as Expression,
          branch: rule.branch,
          marks: rule.marks.map((mark) => ({
            kind: MarkKind.of(mark.kind),
            value: mark.value as Expression,
          })),
        })),
      },
    };
  } catch (error) {
    return {
      ok: false,
      problems: [
        ConfigurationProblem.of({
          path,
          at: 'the file',
          reason: reasoned(error),
        }),
      ],
    };
  }
};
