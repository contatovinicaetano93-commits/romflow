import { Suspense } from "react";
import { InviteRoute } from "./invite-route";

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
    <Suspense fallback={<Loading />}>
      <InviteRoute />
    </Suspense>
  );
}
