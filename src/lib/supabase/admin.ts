import { createClient } from "@supabase/supabase-js";

/** לקוח עם מפתח שירות. לשימוש בשרת בלבד (מרכזייה, צינתוקים). לעולם לא בדפדפן. */
export function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("חסר SUPABASE_SERVICE_ROLE_KEY");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false } });
}
