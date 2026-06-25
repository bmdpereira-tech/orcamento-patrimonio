import { AppShell } from "@/components/app-shell";
import { requireSession } from "@/server/auth/session";

export default async function AuthenticatedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireSession();

  return <AppShell>{children}</AppShell>;
}
