import { fixedPageMetadata, renderFixedPageRoute } from "@/components/public/public-route.server";

type Props = { params: Promise<{ locale: string }> };
export function generateMetadata({ params }: Props) { return fixedPageMetadata(params, "privacy"); }
export default function PrivacyPage({ params }: Props) { return renderFixedPageRoute(params, "privacy"); }
