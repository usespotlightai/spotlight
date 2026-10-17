import { graphqlOperations } from '@integrations/infrastructure/sources/graphql/graphql-operations';
import { openapiOperations } from '@integrations/infrastructure/sources/openapi/openapi-operations';
import {
  DescriptionUnreadable,
  type ReadOperations,
} from '@integrations/infrastructure/sources/operation-record';
import { parse as parseYaml } from 'yaml';

export interface DescriptionInput {
  readonly kind: 'openapi' | 'graphql';
  readonly text: string;
  readonly url: string | null;
  readonly baseUrl: string | null;
  readonly depth: number | null;
  readonly connected: boolean;
}

export type DescriptionAnswered =
  | { readonly kind: 'read'; readonly read: ReadOperations }
  | { readonly kind: 'unread'; readonly problem: string };

const MAX_ALIASES = 100;

const parsed = (text: string): unknown => {
  try {
    return text.trimStart().startsWith('{')
      ? JSON.parse(text)
      : parseYaml(text, { maxAliasCount: MAX_ALIASES });
  } catch (error) {
    throw new DescriptionUnreadable(
      `is not JSON or YAML Spotlight can read: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

export const describedOperations = (
  input: DescriptionInput,
): DescriptionAnswered => {
  try {
    return {
      kind: 'read',
      read:
        input.kind === 'openapi'
          ? openapiOperations(parsed(input.text), {
              url: input.url,
              baseUrl: input.baseUrl,
              connected: input.connected,
            })
          : graphqlOperations(input.text, {
              endpoint: input.url ?? '',
              depth: input.depth,
            }),
    };
  } catch (error) {
    if (error instanceof DescriptionUnreadable) {
      return { kind: 'unread', problem: error.because };
    }

    throw error;
  }
};
