import { fixedPageMetadata, renderFixedPageRoute } from "@/components/public/public-route.server";

type Props = { params: Promise<{ locale: string }> };
export function generateMetadata({ params }: Props) { return fixedPageMetadata(params, "terms"); }
export default function TermsPage({ params }: Props) { return renderFixedPageRoute(params, "terms"); }
