import { RoadmapPage } from "@/components/planning";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RoadmapPage id={id} />;
}
