import { SimulationPage } from "@/components/planning";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SimulationPage id={id} />;
}
