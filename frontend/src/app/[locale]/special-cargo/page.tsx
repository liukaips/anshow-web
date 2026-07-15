import { collectionRouteMetadata, renderCollectionRoute } from "@/components/public/public-route.server";

type Props = { params: Promise<{ locale: string }> };
export function generateMetadata({ params }: Props) { return collectionRouteMetadata(params, "special-cargo"); }
export default function SpecialCargoPage({ params }: Props) { return renderCollectionRoute(params, "special-cargo"); }
