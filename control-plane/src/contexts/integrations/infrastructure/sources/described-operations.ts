import { graphqlOperations } from '@integrations/infrastructure/sources/graphql/graphql-operations';
import { openapiOperations } from '@integrations/infrastructure/sources/openapi/openapi-operations';
import {
  DescriptionUnreadable,
  type ReadOperations,
} from '@integrations/infrastructure/sources/operation-record';
import { parse as parseYaml } from 'yaml';

export interface DescriptionAsked {
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

const ALIASES_AT_MOST = 100;

const parsed = (text: string): unknown => {
  try {
    return text.trimStart().startsWith('{')
      ? JSON.parse(text)
      : parseYaml(text, { maxAliasCount: ALIASES_AT_MOST });
  } catch (error) {
    throw new DescriptionUnreadable(
      `is not JSON or YAML Spotlight can read: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

export const describedOperations = (
  asked: DescriptionAsked,
): DescriptionAnswered => {
  try {
    return {
      kind: 'read',
      read:
        asked.kind === 'openapi'
          ? openapiOperations(parsed(asked.text), {
              url: asked.url,
              baseUrl: asked.baseUrl,
              connected: asked.connected,
            })
          : graphqlOperations(asked.text, {
              endpoint: asked.url ?? '',
              depth: asked.depth,
            }),
    };
  } catch (error) {
    if (error instanceof DescriptionUnreadable) {
      return { kind: 'unread', problem: error.because };
    }

    throw error;
  }
};
