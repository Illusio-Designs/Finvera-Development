import { Suspense } from "react";
import PageLoading from "@/components/admin/PageLoading";
import SocialWorkspace from "./SocialWorkspace";

export default function SocialStudioPage() {
  return <Suspense fallback={<PageLoading label="Loading Social workspace…" variant="panel" count={3} />}>
    <SocialWorkspace />
  </Suspense>;
}
