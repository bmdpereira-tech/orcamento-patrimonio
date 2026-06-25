import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import { UI_TEXT } from "@/content/ui-text";
import { getSession } from "@/server/auth/session";

export default async function LoginPage() {
  const session = await getSession();

  if (session) {
    redirect("/orcamento");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-soft">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase text-brand-700">{UI_TEXT.appName} pessoal</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">Entrar</h1>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}
