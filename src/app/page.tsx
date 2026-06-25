import { redirect } from "next/navigation";
import { getSession } from "@/server/auth/session";

export default async function HomePage() {
  const session = await getSession();

  if (session) {
    redirect("/orcamento");
  }

  redirect("/login");
}
