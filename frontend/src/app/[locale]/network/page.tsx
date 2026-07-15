import { fixedPageMetadata, renderFixedPageRoute } from "@/components/public/public-route.server";

type Props = { params: Promise<{ locale: string }> };
export function generateMetadata({ params }: Props) { return fixedPageMetadata(params, "network"); }
export default function NetworkPage({ params }: Props) { return renderFixedPageRoute(params, "network"); }
