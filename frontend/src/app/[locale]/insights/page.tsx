import { collectionRouteMetadata, renderCollectionRoute } from "@/components/public/public-route.server";

type Props = { params: Promise<{ locale: string }> };
export function generateMetadata({ params }: Props) { return collectionRouteMetadata(params, "insights"); }
export default function InsightsPage({ params }: Props) { return renderCollectionRoute(params, "insights"); }
