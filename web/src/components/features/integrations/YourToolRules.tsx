import { ToolRuleSelect } from '@/components/features/integrations/ToolRuleSelect';
import { useSetToolRule } from '@/hooks/api/useSetToolRule';
import type { ConnectionToolRuleResponseDto } from '@/lib/api';

type YourToolRulesProps = {
  teamId: string;
  integration: string;
  tools: readonly ConnectionToolRuleResponseDto[];
};

const named = (integration: string, tool: string): string =>
  tool.startsWith(`${integration}.`)
    ? tool.slice(integration.length + 1)
    : tool;

export function YourToolRules({
  teamId,
  integration,
  tools,
}: YourToolRulesProps) {
  const setting = useSetToolRule(teamId);

  return (
    <ul
      aria-label={`What may act as you in ${integration}`}
      className="-my-0.5 -mr-2 flex flex-col"
    >
      {tools.map((each) => (
        <li
          key={each.tool}
          className="flex min-h-7 items-center justify-between gap-4"
        >
          <span className="truncate text-foreground text-sm">
            {named(integration, each.tool)}
          </span>
          <ToolRuleSelect
            tool={each.tool}
            rule={each.rule}
            disabled={setting.isPending}
            onRule={(rule) =>
              setting.mutate({ integration, tool: each.tool, rule })
            }
          />
        </li>
      ))}
      {setting.isError && (
        <li role="alert" className="text-destructive text-xs">
          Could not set that rule. Try again.
        </li>
      )}
    </ul>
  );
}
