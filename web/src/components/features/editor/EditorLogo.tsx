import type { SVGProps } from 'react';
import { CursorLogo, VscodeLogo } from '@/components/shared/icons';
import type { EditorApp } from '@/lib/editor';
import { cn } from '@/lib/utils';

const LOGOS = { vscode: VscodeLogo, cursor: CursorLogo } as const;

type EditorLogoProps = SVGProps<SVGSVGElement> & {
  app: EditorApp;
};

export function EditorLogo({ app, className, ...props }: EditorLogoProps) {
  const Logo = LOGOS[app];

  return (
    <Logo
      aria-hidden
      className={cn('size-4 shrink-0 text-foreground', className)}
      {...props}
    />
  );
}
