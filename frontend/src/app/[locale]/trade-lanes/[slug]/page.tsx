import { detailRouteMetadata, renderDetailRoute } from "@/components/public/public-route.server";

type Props = { params: Promise<{ locale: string; slug: string }> };
export function generateMetadata({ params }: Props) { return detailRouteMetadata(params, "trade-lanes"); }
export default function TradeLanePage({ params }: Props) { return renderDetailRoute(params, "trade-lanes"); }
