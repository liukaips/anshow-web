import { detailRouteMetadata, renderDetailRoute } from "@/components/public/public-route.server";

type Props = { params: Promise<{ locale: string; slug: string }> };
export function generateMetadata({ params }: Props) { return detailRouteMetadata(params, "insights"); }
export default function InsightPage({ params }: Props) { return renderDetailRoute(params, "insights"); }
