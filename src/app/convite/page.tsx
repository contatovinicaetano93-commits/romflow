import { Suspense } from "react";
import { InviteRoute } from "./invite-route";
import { StoreProvider } from "@/lib/store";

function Loading() {
  return (
    <div className="app-loading">
      <div className="brand-mark">R</div>
      Validando seu convite...
      <span className="spinner spin" />
    </div>
  );
}

export default function InvitePageRoute() {
  return (
    <StoreProvider>
      <Suspense fallback={<Loading />}>
        <InviteRoute />
      </Suspense>
    </StoreProvider>
  );
}
