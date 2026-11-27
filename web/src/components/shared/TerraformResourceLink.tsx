const DOCS = 'https://docs.usespotlight.ai/docs/reference/terraform';

type TerraformResourceLinkProps = {
  resource: 'secret' | 'skill';
};

export function TerraformResourceLink({
  resource,
}: TerraformResourceLinkProps) {
  return (
    <a
      href={`${DOCS}/${resource}`}
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-2 hover:text-foreground"
    >
      spotlight_{resource}
    </a>
  );
}
