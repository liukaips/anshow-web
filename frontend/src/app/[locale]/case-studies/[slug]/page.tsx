import { detailRouteMetadata, renderDetailRoute } from "@/components/public/public-route.server";

type Props = { params: Promise<{ locale: string; slug: string }> };
export function generateMetadata({ params }: Props) { return detailRouteMetadata(params, "case-studies"); }
export default function CaseStudyPage({ params }: Props) { return renderDetailRoute(params, "case-studies"); }
