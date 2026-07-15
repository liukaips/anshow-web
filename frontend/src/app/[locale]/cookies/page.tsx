import { fixedPageMetadata, renderFixedPageRoute } from "@/components/public/public-route.server";

type Props = { params: Promise<{ locale: string }> };
export function generateMetadata({ params }: Props) { return fixedPageMetadata(params, "cookies"); }
export default function CookiesPage({ params }: Props) { return renderFixedPageRoute(params, "cookies"); }
