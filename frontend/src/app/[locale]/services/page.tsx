import {
  collectionRouteMetadata,
  renderCollectionRoute,
} from "@/components/public/public-route.server";

type Props = { params: Promise<{ locale: string }> };

export function generateMetadata({ params }: Props) {
  return collectionRouteMetadata(params, "services");
}

export default function ServicesPage({ params }: Props) {
  return renderCollectionRoute(params, "services");
}
