import {
  type CatalogItem,
  CatalogSkill,
  CatalogTool,
} from '@catalog/domain/entities/catalog-item.entity';
import { CatalogItemId } from '@catalog/domain/value-objects/catalog-item-id.vo';
import { CatalogName } from '@catalog/domain/value-objects/catalog-name.vo';
import { CatalogVersion } from '@catalog/domain/value-objects/catalog-version.vo';
import { Plan } from '@catalog/domain/value-objects/plan.vo';
import { InputSchema } from '@shared-kernel/domain/value-objects/input-schema.vo';

const listing = (
  name: string,
  version: string,
  needs: Plan,
  description: string,
) => ({
  name: CatalogName.of(name),
  version: CatalogVersion.of(version),
  needs,
  description,
});

const QUERY = {
  name: 'query',
  schema: InputSchema.ofType('string'),
  description: 'What to search for',
  required: true,
  defaulted: false,
  piped: false,
};

const WEB_SEARCH =
  'Search the web, and answer with the pages that match best: each one’s title, address and a short extract.';

const RESEARCH_SKILL = `---
name: spotlight-catalog-research
description: Research a question on the web before answering it, citing the pages the answer rests on.
---
Search with \`catalog.web-search\` first, then read the pages that matter with \`catalog.fetch-page\`.
Cite each page an answer rests on by its address. Say so when the web does not answer a question.
`;

export const CATALOG_ITEMS: readonly CatalogItem[] = [
  CatalogTool.of(listing('web-search', '1.0.0', Plan.team, WEB_SEARCH), [
    QUERY,
  ]),
  CatalogTool.of(listing('web-search', '1.1.0', Plan.team, WEB_SEARCH), [
    QUERY,
    {
      name: 'limit',
      schema: InputSchema.ofType('number'),
      description: 'How many pages to answer with, at most',
      required: false,
      defaulted: false,
      piped: false,
    },
  ]),
  CatalogTool.of(
    listing(
      'fetch-page',
      '1.0.0',
      Plan.free,
      'Fetch a web page, and answer with its readable text.',
    ),
    [
      {
        name: 'url',
        schema: InputSchema.ofType('string'),
        description: 'The page’s address',
        required: true,
        defaulted: false,
        piped: false,
      },
    ],
  ),
  CatalogSkill.of(
    listing(
      'research',
      '1.0.0',
      Plan.team,
      'Research a question on the web before answering it, citing the pages the answer rests on.',
    ),
    [{ path: 'SKILL.md', text: RESEARCH_SKILL }],
    [
      CatalogItemId.parse('catalog.web-search@1.1.0'),
      CatalogItemId.parse('catalog.fetch-page@1.0.0'),
    ],
  ),
];
