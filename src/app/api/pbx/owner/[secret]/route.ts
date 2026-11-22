import { adminClient } from "@/lib/supabase/admin";
import { ownerFlow } from "@/lib/pbx/owner-flow";
import { ownerDeps } from "@/lib/pbx/db";
import { pbxHandler } from "@/lib/pbx/route";

async function handle(req: Request, { params }: { params: Promise<{ secret: string }> }) {
  const { secret } = await params;
  return pbxHandler(req, secret, process.env.PBX_SECRET, "owner", (q) => ownerFlow(q, ownerDeps(adminClient())));
}
export { handle as GET, handle as POST };
