import { certificationsRouteMetadata, renderCertificationsRoute } from "@/components/public/public-route.server";

type Props = { params: Promise<{ locale: string }> };
export function generateMetadata({ params }: Props) { return certificationsRouteMetadata(params); }
export default function CertificationsPage({ params }: Props) { return renderCertificationsRoute(params); }
