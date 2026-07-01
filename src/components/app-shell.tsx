import {
  Banknote,
  BarChart3,
  BriefcaseBusiness,
  CreditCard,
  Landmark,
  LogOut,
  ReceiptText,
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
  { href: "/igcp", label: UI_TEXT.navigation.igcp, icon: ReceiptText },
  { href: "/configuracoes", label: UI_TEXT.navigation.settings, icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1800px] flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:gap-4 lg:px-8">
          <Link href="/orcamento" className="flex min-w-0 shrink-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-700 text-lg font-bold text-white">
              O
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold uppercase text-brand-700">{UI_TEXT.appName}</span>
              <span className="block text-sm text-slate-600">{UI_TEXT.appSubtitle}</span>
            </span>
          </Link>

          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between lg:flex-1 lg:justify-end">
            <nav
              aria-label="Navegação principal"
              className="flex min-w-0 flex-wrap items-center gap-1.5 lg:flex-nowrap lg:justify-end"
            >
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-slate-700 hover:bg-brand-50 hover:text-brand-900"
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <form action={logoutAction} className="shrink-0">
              <button className="inline-flex h-9 items-center gap-2 rounded-md px-2.5 text-sm font-medium text-slate-700 hover:bg-red-50 hover:text-red-700">
                <LogOut className="h-4 w-4" aria-hidden="true" />
                {UI_TEXT.navigation.logout}
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
