"use client";

import { useSearchParams } from "next/navigation";
import { ClientApp } from "@/components/client-app";

export function InviteRoute() {
  const params = useSearchParams();
  return <ClientApp inviteToken={params.get("token") ?? ""} />;
}
