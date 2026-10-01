import { Suspense } from "react";
import { ScholarshipsPage } from "@/components/scholarships";
export default function Page() {
  return (
    <Suspense>
      <ScholarshipsPage />
    </Suspense>
  );
}
