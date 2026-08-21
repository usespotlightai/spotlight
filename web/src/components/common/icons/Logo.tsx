import type { SVGProps } from "react";
const SvgLogo = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 48 48"
    {...props}
  >
    <rect width={48} height={48} fill="#292929" rx={8} />
    <circle cx={24} cy={24} r={8.1} fill="#fff" />
    <path
      stroke="#fff"
      strokeLinecap="round"
      strokeWidth={2.3}
      d="M12.81 23.61a11.2 11.2 0 0 1 10.8-10.8M35.19 24.39a11.2 11.2 0 0 1-10.8 10.8"
    />
  </svg>
);
export default SvgLogo;
