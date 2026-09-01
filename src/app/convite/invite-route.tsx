"use client";

import { useSearchParams } from "next/navigation";
import { RomFlowApp } from "@/components/rom-flow-app";

export function InviteRoute() {
  const params = useSearchParams();
  return <RomFlowApp inviteToken={params.get("token") ?? ""} />;
}
