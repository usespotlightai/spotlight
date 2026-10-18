import type { ConfigFolder } from '@work/domain/value-objects/config-folder.vo';

const BRANCH = 'spotlight-configuration';

export const SettingUp = {
  opening(team: string | null): string {
    return [
      `You are setting up${team ? ` the ${team} team's` : ' the team’s'} Spotlight configuration as code, together with a person. Learn how the team works from its code and its tools, then propose the team's first Terraform as a pull request.`,
      'You recommend; a person reviews and applies. Never run `terraform apply`, and never change Spotlight through its API.',
    ].join(' ');
  },

  section(configFolder: ConfigFolder, workspaceId: string): string {
    const folder = `${configFolder.repository.name}/${configFolder.folder}`;
    const exported = `"$SPOTLIGHT_URL/api/resources/workspaces/${workspaceId}/export"`;

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
        'Read git history for how pull requests are sized, named and merged.',
      ].join('\n'),
      [
        '### 2. Learn how the team uses its tools',
        'List the team’s tools with `spotlight tools`, and call only those that read. Find out, for example, the issue labels and workflow states the team uses and how issues get assigned.',
      ].join('\n'),
      [
        '### 3. Talk it through',
        'Tell the person briefly what you found and what you would change from Spotlight’s built-in lines, and ask about anything unclear. Depart from the built-in lines only where the repositories or tools give evidence. Wait for them to agree before you draft.',
      ].join('\n'),
      [
        '### 4. Draft the Terraform',
        `Start from the workspace’s current configuration, so the pull request is a change and not a fresh start. Write it into \`${folder}/\`, keep what belongs to this team, and leave the rest out:`,
        `\`\`\`\ncd ${folder}\ncurl -fsS -H "Authorization: Bearer $SPOTLIGHT_API_TOKEN" ${exported} \\\n  | jq -c '.files[]' | while read -r file; do\n      path=$(jq -r .path <<<"$file"); mkdir -p "$(dirname "$path")"\n      jq -j .content <<<"$file" > "$path"\n    done\n\`\`\``,
        'Then adapt it:',
        '- `main.tf` with the team’s lines, each with `source { repository, path }` naming this file',
        '- a prompt file per station, `prompts/<team>/<line>/<station>.md`, adapted to what you learned',
        '- each station’s `setup` and `check` commands from the survey',
        '- `skills/` adopted from the team’s own rules files',
        '- a `reviews` policy from `CODEOWNERS`, and a few `match` hooks for risky paths',
      ].join('\n'),
      [
        '### 5. Check it',
        '`SPOTLIGHT_URL` and `SPOTLIGHT_API_TOKEN` are set for this run, and the token may read and plan, nothing more. Run `terraform init`, `terraform fmt`, `terraform validate` and `terraform plan`, and keep the plan’s output for the pull request. The plan should only import what exists and change what you adapted. If `terraform init` cannot download the provider, say so and open the pull request without a plan.',
      ].join('\n'),
      [
        '### 6. Open the pull request',
        `Commit on a new branch, such as \`${BRANCH}\`, push it, and open the pull request:`,
        `\`\`\`\nspotlight setup-pull-request --branch ${BRANCH} --title "…" < body.md\n\`\`\``,
        'In the body, list each departure from the built-in lines as a decision with the files it rests on, and add the plan.',
      ].join('\n'),
    ].join('\n\n');
  },
};
