import { adminClient } from "@/lib/supabase/admin";
import { mainFlow } from "@/lib/pbx/main-flow";
import { mainDeps } from "@/lib/pbx/db";
import { pbxHandler } from "@/lib/pbx/route";

async function handle(req: Request, { params }: { params: Promise<{ secret: string }> }) {
  const { secret } = await params;
  return pbxHandler(req, secret, process.env.PBX_SECRET, "customer", (q) => mainFlow(q, mainDeps(adminClient())));
}
export { handle as GET, handle as POST };
