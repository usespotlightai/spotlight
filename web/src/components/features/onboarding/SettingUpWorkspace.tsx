import { LoaderCircle } from 'lucide-react';
import { AuthScreen } from '@/components/shell/auth/AuthScreen';
import { AuthTitle } from '@/components/shell/auth/AuthTitle';

export function SettingUpWorkspace() {
  return (
    <AuthScreen className="w-80 items-center">
      <LoaderCircle
        aria-hidden
        className="size-5 animate-spin text-muted-foreground"
      />
      <div role="status">
        <AuthTitle title="Setting up your workspace…" large>
          Spotlight creates the lines of your team and adds a setup task to your
          inbox.
        </AuthTitle>
      </div>
    </AuthScreen>
  );
}
