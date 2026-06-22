import { ChildDetail } from "@/components/child-detail";

export default async function ChildDetailPage({ params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  return <ChildDetail childId={childId} />;
}
