import { quoteRouteMetadata, renderQuoteRoute } from "@/components/public/public-route.server";

type Props = { params: Promise<{ locale: string }> };
export function generateMetadata({ params }: Props) { return quoteRouteMetadata(params); }
export default function QuotePage({ params }: Props) { return renderQuoteRoute(params); }
