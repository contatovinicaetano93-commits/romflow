"use client";

import { StoreProvider } from "@/lib/store";
import { RomFlowApp } from "@/components/rom-flow-app";

export function ClientApp({ inviteToken }: { inviteToken?: string }) {
  return (
    <StoreProvider>
      <RomFlowApp inviteToken={inviteToken} />
    </StoreProvider>
  );
}
