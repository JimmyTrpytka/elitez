import { renderAppIcon } from "@/lib/app-icon";

const variants = {
  "192": { size: 192, padding: 0 },
  "512": { size: 512, padding: 0 },
  maskable: { size: 512, padding: 80 },
} as const;

export function generateStaticParams() {
  return Object.keys(variants).map((variant) => ({ variant }));
}

export async function GET(
  _request: Request,
  { params }: RouteContext<"/pwa-icons/[variant]">,
) {
  const { variant } = await params;
  const config = variants[variant as keyof typeof variants];
  if (!config) return new Response("Not found", { status: 404 });
  return renderAppIcon(config.size, config.padding);
}
