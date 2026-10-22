import { buttonVariants } from '@/components/ui/button-variants';
import { TERRAFORM_FROM_CI_DOCS } from '@/lib/oidc-trust';
import { cn } from '@/lib/utils';

export function NoOidcTrusts() {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <p className="text-muted-foreground text-sm">
        No OIDC trusts. Define them with Terraform.
      </p>
      <a
        href={TERRAFORM_FROM_CI_DOCS}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          buttonVariants({ variant: 'outline', size: 'sm' }),
          'shrink-0 rounded-full bg-card shadow-none',
        )}
      >
        Run Terraform from GitHub Actions
      </a>
    </div>
  );
}
