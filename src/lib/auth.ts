import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "admin" | "agent" | "owner" | "none";

export async function getSession(allowed?: Role[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles").select("role, full_name, owner_id").eq("id", user.id).single();
  const role = (profile?.role ?? "none") as Role;
  if (allowed && !allowed.includes(role)) redirect("/");
  return { supabase, user, role, ownerId: (profile?.owner_id ?? null) as string | null, name: profile?.full_name ?? user.email ?? "" };
}
