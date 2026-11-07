import type { ApiConvention } from '@platform/http/api-conventions';
import { EXPRESSIONS } from '@platform/http/routes';

export const INTEGRATIONS_API_CONVENTIONS: readonly ApiConvention[] = [
  {
    title: 'Expression checks',
    text: `\`POST /${EXPRESSIONS}/check\` type-checks one CEL expression at the attribute that contains it, named within the resource's whole definition (\`integration.webhook.events[0].when\`), as \`terraform plan\` needs. What the expression may read is worked out from that definition exactly as applying it would, so a plan fails where an apply would; a definition that has an error fails with 422, each error under \`definition\`. It returns the type and any errors, each with the span it is about and a suggestion where a declared name is near, and warnings about the definition, such as a capture shadowing a built-in name. \`GET /${EXPRESSIONS}/positions\` lists every position, with \`[*]\` for any index or key, and the variables an expression there can read. They follow these headers and problems, but are not resources.`,
  },
];
