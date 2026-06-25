import {
  Banknote,
  BarChart3,
  BriefcaseBusiness,
  CreditCard,
  Landmark,
  LogOut,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { UI_TEXT } from "@/content/ui-text";

const navigation = [
  { href: "/orcamento", label: UI_TEXT.navigation.budget, icon: Banknote },
  { href: "/historico", label: UI_TEXT.navigation.history, icon: BarChart3 },
  { href: "/contas", label: UI_TEXT.navigation.accounts, icon: Landmark },
  { href: "/debitos-directos", label: UI_TEXT.navigation.recurring, icon: CreditCard },
  { href: "/investimentos", label: UI_TEXT.navigation.investments, icon: BriefcaseBusiness },
  { href: "/configuracoes", label: UI_TEXT.navigation.settings, icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <Link href="/orcamento" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-700 text-lg font-bold text-white">
              O
            </span>
            <span>
              <span className="block text-sm font-semibold uppercase text-brand-700">{UI_TEXT.appName}</span>
              <span className="block text-sm text-slate-600">{UI_TEXT.appSubtitle}</span>
            </span>
          </Link>

          <nav aria-label="Navegação principal" className="flex flex-wrap items-center gap-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-brand-50 hover:text-brand-900"
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
            <form action={logoutAction}>
              <button className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-red-50 hover:text-red-700">
                <LogOut className="h-4 w-4" aria-hidden="true" />
                {UI_TEXT.navigation.logout}
              </button>
            </form>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
