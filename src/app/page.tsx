import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth/session";

/** Entry point: straight to the dashboard when signed in, otherwise to login. */
export default async function RootPage() {
  const user = await getSessionUser();
  redirect(user ? "/dashboard" : "/login");
}
