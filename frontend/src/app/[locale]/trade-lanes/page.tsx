import { collectionRouteMetadata, renderCollectionRoute } from "@/components/public/public-route.server";

type Props = { params: Promise<{ locale: string }> };
export function generateMetadata({ params }: Props) { return collectionRouteMetadata(params, "trade-lanes"); }
export default function TradeLanesPage({ params }: Props) { return renderCollectionRoute(params, "trade-lanes"); }
