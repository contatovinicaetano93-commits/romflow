import { Suspense } from "react";
import { RecoverRoute } from "./recover-route";

function Loading() {
  return (
    <div className="app-loading">
      <div className="brand-mark">R</div>
      Validando o link de senha...
      <span className="spinner spin" />
    </div>
  );
}

export default function RecoverPageRoute() {
  return (
    <Suspense fallback={<Loading />}>
      <RecoverRoute />
    </Suspense>
  );
}
