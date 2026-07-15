import { fixedPageMetadata, renderFixedPageRoute } from "@/components/public/public-route.server";

type Props = { params: Promise<{ locale: string }> };
export function generateMetadata({ params }: Props) { return fixedPageMetadata(params, "about"); }
export default function AboutPage({ params }: Props) { return renderFixedPageRoute(params, "about"); }
