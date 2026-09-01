import { Suspense } from "react";
import { RomFlowApp } from "@/components/rom-flow-app";
import { StoreProvider } from "@/lib/store";

function Loading() {
  return (
    <div className="app-loading">
      <div className="brand-mark">R</div>
      Preparando seu fluxo...
      <span className="spinner spin" />
    </div>
  );
}

export default function HomePage() {
  return (
    <StoreProvider>
      <Suspense fallback={<Loading />}>
        <RomFlowApp />
      </Suspense>
    </StoreProvider>
  );
}
