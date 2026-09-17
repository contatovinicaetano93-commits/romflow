"use client";

import { useSearchParams } from "next/navigation";
import { RecoverPage } from "@/components/recover-page";

export function RecoverRoute() {
  const params = useSearchParams();
  return <RecoverPage token={params.get("token") ?? ""} />;
}
