import { detailRouteMetadata, renderDetailRoute } from "@/components/public/public-route.server";

type Props = { params: Promise<{ locale: string; slug: string }> };
export function generateMetadata({ params }: Props) { return detailRouteMetadata(params, "special-cargo"); }
export default function SpecialCargoDetailPage({ params }: Props) { return renderDetailRoute(params, "special-cargo"); }
