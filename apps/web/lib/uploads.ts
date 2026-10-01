import type { Document } from "@/types";
import { api } from "@/lib/api";

const freeDeployment = process.env.NEXT_PUBLIC_FREE_DEPLOYMENT_MODE === "true";

export async function uploadDocument(file: File, documentType: string): Promise<Document> {
  if (freeDeployment && file.size > 4 * 1024 * 1024)
    throw new Error("Free hosting accepts uploads up to 4 MB. Compress the document and retry.");
  const body = new FormData();
  body.append("file", file);
  body.append("document_type", documentType);
  return api<Document>("/documents", { method: "POST", body });
}
