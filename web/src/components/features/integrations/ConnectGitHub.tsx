import { ChevronDown } from 'lucide-react';
import { useId } from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useConnectGitHubInstallation } from '@/hooks/api/useConnectGitHubInstallation';
import { useGitHubInstallations } from '@/hooks/api/useGitHubInstallations';
import { cn } from '@/lib/utils';

type ConnectGitHubProps = {
  slug: string;
  installUrl: string;
  className: string;
  align?: 'start' | 'end';
};

export function ConnectGitHub({
  slug,
  installUrl,
  className,
  align = 'start',
}: ConnectGitHubProps) {
  const installations = useGitHubInstallations(slug);
  const connect = useConnectGitHubInstallation(slug);
  const found = installations.data ?? [];
  const hint = useId();

  if (found.length === 0) {
    return (
      <a href={installUrl} data-need="github" className={className}>
        Install on GitHub
      </a>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-need="github"
        disabled={connect.isPending}
        className={cn(className, 'gap-1')}
      >
        Connect GitHub
        <ChevronDown className="size-3.5" aria-hidden />
      </DropdownMenuTrigger>

      <DropdownMenuContent align={align} className="w-auto min-w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Installed on</DropdownMenuLabel>
          {found.map((each) => (
            <DropdownMenuItem
              key={each.id}
              closeOnClick
              disabled={each.usedElsewhere}
              aria-describedby={each.usedElsewhere ? hint : undefined}
              onClick={() => connect.mutate(each.id)}
              className={cn(each.usedElsewhere && 'flex-col items-start gap-0')}
            >
              <div>{each.account}</div>
              {each.usedElsewhere && (
                <div className="text-muted-foreground text-xs">
                  Used by {each.usedBy ?? 'another workspace'}
                </div>
              )}
            </DropdownMenuItem>
          ))}
          {found.some((each) => each.usedElsewhere) && (
            <p
              id={hint}
              className="max-w-60 px-1.5 py-1 text-muted-foreground text-xs leading-5"
            >
              An installation serves one workspace. Install on another account
              to connect this workspace.
            </p>
          )}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          closeOnClick
          render={<a href={installUrl}>Install on another account</a>}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
