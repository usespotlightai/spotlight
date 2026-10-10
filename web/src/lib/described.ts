import type { ConfiguredDescriptionResponseDto } from '@/lib/api';
import { since } from '@/lib/since';

const DESCRIPTIONS: Readonly<
  Record<ConfiguredDescriptionResponseDto['kind'], string>
> = {
  openapi: 'OpenAPI description',
  graphql: 'GraphQL schema',
  mcp: 'MCP server',
};

export const toolsCounted = (tools: number): string =>
  tools === 1 ? '1 tool' : `${tools} tools`;

export const readProblemShown = ({
  kind,
  problem,
}: ConfiguredDescriptionResponseDto): string | null =>
  problem ? `Its ${DESCRIPTIONS[kind]} ${problem}.` : null;

export const toolsReadShown = ({
  kind,
  tools,
  readAt,
}: ConfiguredDescriptionResponseDto): string =>
  `${toolsCounted(tools)} from its ${DESCRIPTIONS[kind]}, read ${since(readAt)}`;
