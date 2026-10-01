import { ScholarshipDetail } from "@/components/scholarships";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ScholarshipDetail id={id} />;
}
