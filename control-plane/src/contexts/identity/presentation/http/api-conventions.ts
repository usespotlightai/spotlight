import type { ApiConvention } from '@platform/http/api-conventions';
import { WORKSPACE_TOKEN_EXCHANGE } from '@platform/http/routes';

export const IDENTITY_API_CONVENTIONS: readonly ApiConvention[] = [
  {
    title: 'Credentials',
    text: `A client calls with a person's session or with a workspace token. A script or Terraform sends a workspace token, or the login that \`spotlight login\` stores, as \`Authorization: Bearer <token>\`. A login acts as its person, with that person's role. A token acts only within its own workspace and only as its scopes allow. \`read\`, \`plan\` and \`configure\` are a ladder: \`read\` reads, \`plan\` also checks expressions, and \`configure\` also creates, updates and deletes configuration as a workspace admin may, except secrets, runners and OIDC trusts. \`secrets\` is granted beside one of them and lets the token create, rebind, rotate and delete secrets; Terraform that manages secrets uses \`["configure", "secrets"]\`. \`runners\` is granted the same way and lets the token create, rekey and delete runners and runner trusts and create, update and delete the workspace's runners, since a runner claims runs, checks out repositories and keeps git credentials; Terraform that manages runners uses \`["configure", "runners"]\`. \`trusts\` is granted the same way and lets the token create, update and delete OIDC trusts, since a trust hands out tokens; a token can only create a trust that grants scopes it has itself, so bootstrap the trusts once with a token that has \`trusts\` and every scope they grant, as in \`["configure", "secrets", "trusts"]\`, and revoke it. No token manages members or tokens, or reads the audit.`,
  },
  {
    title: 'CI without a stored token',
    text: `A workspace admin, or a token granted \`trusts\`, creates an OIDC trust naming an OIDC issuer, audience, subject and claims, and the scopes and lifetime (at most an hour) of the tokens it issues. A CI job exchanges the OIDC token its platform issues it at \`POST /${WORKSPACE_TOKEN_EXCHANGE}/exchange\` with \`{ "trust": <trust id>, "token": <OIDC token> }\`, and calls with the short-lived token it gets back. Deleting the trust stops every token that it issued at once, and the audit names the trust and the workload's subject beside each exchange and each change made with an issued token.`,
  },
];
