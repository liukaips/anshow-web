import { collectionRouteMetadata, renderCollectionRoute } from "@/components/public/public-route.server";

type Props = { params: Promise<{ locale: string }> };
export function generateMetadata({ params }: Props) { return collectionRouteMetadata(params, "case-studies"); }
export default function CaseStudiesPage({ params }: Props) { return renderCollectionRoute(params, "case-studies"); }
