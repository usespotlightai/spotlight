import type { Release } from '@shared-kernel/domain/value-objects/release.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { CI_VARIABLES } from '@work/application/services/ci-setups.service';
import type { CiSetup } from '@work/domain/value-objects/ci-setup.vo';
import type { ConfigFolder } from '@work/domain/value-objects/config-folder.vo';

const BRANCH = 'spotlight-configuration';

const WORKFLOW = '.github/workflows/spotlight.yml';

const downloadsOf = (release: Release | null): string =>
  `https://github.com/usespotlightai/spotlight/releases/download/${release?.value ?? 'canary'}`;

const stateSignIn = (release: Release | null): string[] => [
  '      - name: Download spotlight',
  // biome-ignore lint/suspicious/noTemplateCurlyInString: GitHub Actions expression syntax
  '        working-directory: ${{ runner.temp }}',
  '        run: |',
  `          base=${downloadsOf(release)}`,
  '          curl -fsSL -o spotlight "$base/spotlight-linux-amd64"',
  '          curl -fsSL -o spotlight.sha256 "$base/spotlight-linux-amd64.sha256"',
  '          echo "$(cut -d\' \' -f1 spotlight.sha256)  spotlight" | sha256sum -c -',
  '          chmod +x spotlight',
  '      - name: Sign in to the state',
  '        run: |',
  '          token=$("$RUNNER_TEMP/spotlight" token)',
  '          echo "::add-mask::$token"',
  '          echo "TF_HTTP_PASSWORD=$token" >> "$GITHUB_ENV"',
];

const workflowOf = (
  folder: string,
  defaultBranch: string,
  release: Release | null,
): string =>
  [
    'name: Spotlight',
    '',
    'on:',
    '  pull_request:',
    `    paths: ["${folder}/**", "${WORKFLOW}"]`,
    '  push:',
    `    branches: [${JSON.stringify(defaultBranch)}]`,
    `    paths: ["${folder}/**", "${WORKFLOW}"]`,
    '',
    'permissions:',
    '  contents: read',
    '  id-token: write',
    '',
    'env:',
    `  SPOTLIGHT_URL: \${{ vars.${CI_VARIABLES.url} }}`,
    '',
    'jobs:',
    '  plan:',
    "    if: github.event_name == 'pull_request'",
    '    runs-on: ubuntu-24.04',
    '    env:',
    `      SPOTLIGHT_OIDC_TRUST: \${{ vars.${CI_VARIABLES.planTrust} }}`,
    '    defaults:',
    '      run:',
    `        working-directory: ${folder}`,
    '    steps:',
    '      - uses: actions/checkout@v5',
    '      - uses: hashicorp/setup-terraform@v3',
    '        with:',
    '          terraform_wrapper: false',
    ...stateSignIn(release),
    '      - run: terraform fmt -check -recursive',
    '      - run: terraform init -input=false',
    '      - run: terraform validate',
    '      - run: terraform plan -input=false -lock=false',
    '',
    '  apply:',
    "    if: github.event_name == 'push'",
    '    runs-on: ubuntu-24.04',
    '    concurrency: spotlight-apply',
    '    env:',
    `      SPOTLIGHT_OIDC_TRUST: \${{ vars.${CI_VARIABLES.applyTrust} }}`,
    '    defaults:',
    '      run:',
    `        working-directory: ${folder}`,
    '    steps:',
    '      - uses: actions/checkout@v5',
    '      - uses: hashicorp/setup-terraform@v3',
    '        with:',
    '          terraform_wrapper: false',
    ...stateSignIn(release),
    '      - run: terraform init -input=false',
    '      - run: terraform apply -input=false -auto-approve',
  ].join('\n');

const ciStep = (
  configFolder: ConfigFolder,
  ci: CiSetup,
  release: Release | null,
): string =>
  [
    '### 7. Run Terraform in GitHub Actions',
    `Spotlight already trusts the GitHub Actions of \`${configFolder.repository.value}\`. Both trusts are in the export. Keep them in the Terraform as they are: CI may not change trusts, so an admin changes them. In the pull request, say this:`,
    `- \`github-pull-requests\` (\`${ci.pullRequestsTrustId}\`): a pull request may plan.`,
    `- \`github-apply\` (\`${ci.defaultBranchTrustId}\`): a push to \`${ci.defaultBranch}\` may apply, with the \`configure\`, \`secrets\` and \`runners\` scopes.`,
    ci.variables === 'written'
      ? `Spotlight set the repository variables \`${CI_VARIABLES.url}\`, \`${CI_VARIABLES.planTrust}\` and \`${CI_VARIABLES.applyTrust}\`.`
      : `The GitHub App may not write repository variables. In the pull request, tell the person to add these repository variables: \`${CI_VARIABLES.planTrust}\` = \`${ci.pullRequestsTrustId}\`, \`${CI_VARIABLES.applyTrust}\` = \`${ci.defaultBranchTrustId}\`, and \`${CI_VARIABLES.url}\` = the Spotlight address in \`$SPOTLIGHT_URL\`.`,
    `Add \`${WORKFLOW}\` at the repository root. Start from this, and add the \`TF_VAR_\` secrets that the variables need. Its two state steps sign in to Spotlight's state with the job's OIDC token. If the team keeps the state elsewhere, replace those two steps with that backend's credentials:`,
    `\`\`\`yaml\n${workflowOf(configFolder.folder, ci.defaultBranch, release)}\n\`\`\``,
    'In the pull request, list each secret the person must add to the repository, and say what it is for. Also say that a pull request from a fork gets no OIDC token from GitHub, so its plan job fails.',
    ...(ci.defaultBranchProtected
      ? []
      : [
          `As far as Spotlight can see, \`${ci.defaultBranch}\` does not require an approving review. Anyone who can push to \`${ci.defaultBranch}\` can change this workspace's configuration through the apply trust. Say this first in the pull request, and recommend a branch protection rule or ruleset that requires at least one approving review.`,
        ]),
  ].join('\n');

export const SettingUp = {
  opening(team: string | null): string {
    return [
      `You are setting up${team ? ` the ${team} team's` : ' the team’s'} Spotlight configuration as code, together with a person. Learn how the team works from its code and its tools, then propose the team's first Terraform as a pull request.`,
      'You recommend; a person reviews and applies. Never run `terraform apply`, and never change Spotlight through its API.',
    ].join(' ');
  },

  section(
    configFolder: ConfigFolder,
    workspaceId: string,
    repositories: readonly Repository[],
    spotlightUrl: string,
    release: Release | null,
  ): string {
    const folder = `${configFolder.repository.name}/${configFolder.folder}`;
    const alone = repositories.every((each) =>
      each.equals(configFolder.repository),
    );
    const exported = `"$SPOTLIGHT_URL/api/v1/resources/workspaces/${workspaceId}/export"`;
    const state = `${spotlightUrl.replace(/\/+$/, '')}/api/terraform/workspaces/<slug>/states/default`;

    return [
      '## Setting up configuration as code',
      `The configuration lives in \`${configFolder.repository.value}\`, under \`${configFolder.folder}/\`. It is checked out at \`${folder}/\`.`,
      [
        '### 1. Survey the repositories',
        'Read each checked-out repository and note, with the files you found them in:',
        '- languages and package managers',
        '- build, test and lint commands',
        '- CI workflows, `CODEOWNERS` and pull request templates',
        '- migration folders and deploy configuration',
        '- agent rules already written: `AGENTS.md`, `CLAUDE.md`, `.cursor/rules`, `.github/copilot-instructions.md`',
        '- observability: error tracking, metrics, logs, tracing and alerting, such as Sentry, Grafana, Datadog, Prometheus, OpenTelemetry or PagerDuty. Look for their SDKs and config, alert rules, dashboards as code, runbooks and on-call files.',
        'Read git history for how pull requests are sized, named and merged.',
        ...(alone
          ? [
              '',
              `Only \`${configFolder.repository.value}\` is checked out. If the team’s code is in other repositories, you cannot read it in this chat. Tell the person this first, and ask them to start a new setup chat with those repositories. Do not draft from guesses.`,
            ]
          : []),
      ].join('\n'),
      [
        '### 2. Learn how the team uses its tools',
        'List the team’s tools with `spotlight tools`, and call only those that read. Find out, for example, the issue labels and workflow states the team uses and how issues get assigned.',
        'If the team has an observability tool, read its current alerts and the errors that occur most. Find out which services they come from and who acts on them today.',
      ].join('\n'),
      [
        '### 3. Talk it through',
        'Tell the person briefly what you found and what you would change from Spotlight’s built-in lines, and ask about anything unclear. Depart from the built-in lines only where the repositories or tools give evidence. Wait for them to agree before you draft.',
        'Always talk about operations. Help the team own what it ships in production: the agents must use the team’s observability tools as a normal part of their work. Say which tools you found and how you would connect them. If you found none, say so, and recommend that the team sets up error tracking and alerting first. Do not connect a tool that the team does not use.',
        'Ask where the team keeps Terraform state, for example an S3 bucket or HCP Terraform. Local state is lost with the sandbox. If the team has no backend yet, recommend that Spotlight keeps the state: it needs no other account, and CI signs in to it with the same OIDC trust as the provider.',
      ].join('\n'),
      [
        '### 4. Draft the Terraform',
        `Start from the workspace’s current configuration, so the pull request is a change and not a fresh start. Write it into \`${folder}/\`, keep what belongs to this team, and leave the rest out:`,
        `\`\`\`\ncd ${folder}\ncurl -fsS -H "Authorization: Bearer $SPOTLIGHT_API_TOKEN" ${exported} \\\n  | jq -c '.files[]' | while read -r file; do\n      path=$(jq -r .path <<<"$file"); mkdir -p "$(dirname "$path")"\n      jq -j .content <<<"$file" > "$path"\n    done\n\`\`\``,
        'The export has one file per concern, such as `line-<team>-<line>.tf` and `imports.tf`. Keep that layout, and keep the `.tf` files at the top of the folder. Then adapt it:',
        '- each line’s `source { repository, path }`, naming its own `line-<team>-<line>.tf`',
        '- the `backend` in `terraform.tf`. For Spotlight’s, read the workspace’s `slug`, and write the block below with it. Keep this address: inside the sandbox, `$SPOTLIGHT_URL` can be an address that only this host reaches.',
        `\`\`\`\ncurl -fsS -H "Authorization: Bearer $SPOTLIGHT_API_TOKEN" "$SPOTLIGHT_URL/api/v1/resources/workspaces/${workspaceId}"\n\`\`\``,
        `\`\`\`hcl\nbackend "http" {\n  address        = "${state}"\n  lock_address   = "${state}/lock"\n  unlock_address = "${state}/lock"\n  lock_method    = "POST"\n  unlock_method  = "DELETE"\n  username       = "spotlight"\n}\n\`\`\``,
        '- `locals.tf` for values that two or more resources share, such as a tool list or a `check` command',
        '- a `README.md` that says what the folder configures, which variables to set, and how to plan and apply. If Spotlight keeps the state, say that Terraform reads its token from `TF_HTTP_PASSWORD`: `export TF_HTTP_PASSWORD=$(spotlight token)` after `spotlight login`, and the same command in CI, where it exchanges the job’s OIDC token through the trust.',
        '- a prompt file per station, `prompts/<team>/<line>/<station>.md`, adapted to what you learned',
        '- each station’s `setup` and `check` commands from the survey',
        '- a `judge` block on each work station with an agent, so Insights scores its runs from the start. Write its rubric in `judges/<team>/<line>/<station>.md`, starting with `scores: yes-no` or `scores: 1-5`, from what a good run at that station does for this team. Read it with `file()`, and set `sample = 0.2` and `min_agreement = 0.6` unless the team asks for other values.',
        '- `skills/` adopted from the team’s own rules files',
        '- a `reviews` policy from `CODEOWNERS`, and a few `match` hooks for risky paths',
      ].join('\n'),
      [
        '### 5. Connect operations',
        'For each observability tool the team uses:',
        '- a `spotlight_integration` with its tools, for example its `mcp` server, and the secrets it needs',
        '- a `webhook` or `poll` whose `events[].raise.opens` turns a new alert or error into a task. Open it on the delivery line at `triage`, or on a line of its own if the team keeps incidents apart, such as `role = "incidents"`. Add a `reaction` that completes the task when the alert resolves.',
        '- these tools on Triage, Implementation and Code Review, with a skill that says how the team reads errors, metrics and alerts',
        'Then adapt the prompts:',
        '- Triage: for an alert or an error, find its cause in the observability tool before you plan the fix.',
        '- Spec: name the signals that show the change works in production, and the alerts it needs.',
        '- Implementation: before a change, look at the current errors and alerts of the code it touches. Add the logging, metrics and alerts that the spec names.',
        '- Code Review: ask how the team will know when the change fails in production.',
      ].join('\n'),
      [
        '### 6. Check it',
        '`SPOTLIGHT_URL` and `SPOTLIGHT_API_TOKEN` are set for this run, and the token may read and plan, nothing more. If Spotlight keeps the state, first run `export TF_HTTP_PASSWORD=$SPOTLIGHT_API_TOKEN`. Run `terraform init`, `terraform fmt`, `terraform validate` and `terraform plan`, and keep the plan’s output for the pull request. The plan should only import what exists and change what you adapted. If `terraform init` cannot download the provider, say so and open the pull request without a plan.',
      ].join('\n'),
      ...(configFolder.ci
        ? [ciStep(configFolder, configFolder.ci, release)]
        : []),
      [
        `### ${configFolder.ci ? 8 : 7}. Open the pull request`,
        `Commit on a new branch, such as \`${BRANCH}\`, push it, and open the pull request:`,
        `\`\`\`\nspotlight tools call setup-pull-request --branch ${BRANCH} --title "…" < body.md\n\`\`\``,
        'In the body, list each departure from the built-in lines as a decision with the files it rests on. Say which observability tools you connected, or why there are none. Say which stations have a judge, and what each rubric checks. Add the plan.',
      ].join('\n'),
    ].join('\n\n');
  },
};
