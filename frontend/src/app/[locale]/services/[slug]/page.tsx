import {
  detailRouteMetadata,
  renderDetailRoute,
} from "@/components/public/public-route.server";

type Props = { params: Promise<{ locale: string; slug: string }> };

export function generateMetadata({ params }: Props) {
  return detailRouteMetadata(params, "services");
}

export default function ServicePage({ params }: Props) {
  return renderDetailRoute(params, "services");
}
