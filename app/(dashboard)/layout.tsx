import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  LogOut,
  LayoutDashboard,
  Settings as SettingsIcon,
  Book,
} from "lucide-react";
import CreditBalance from "@/components/CreditBalance";
import { CreditProvider } from "@/components/CreditProvider";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/");
  }

  return (
    <CreditProvider>
      <div className="min-h-screen bg-[var(--background)] flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-[var(--border)] bg-[var(--card)] flex flex-col hidden md:flex">
        <div className="h-16 flex items-center px-6 border-b border-[var(--border)]">
          <span className="text-xl font-semibold tracking-tight">RAG SaaS</span>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <Link
            href="/projects"
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--muted)] transition-colors text-[var(--foreground)] font-medium"
          >
            <LayoutDashboard size={20} />
            Projects
          </Link>
          <Link
            href="/settings"
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--muted)] transition-colors text-[var(--foreground)] font-medium"
          >
            <SettingsIcon size={20} />
            Settings
          </Link>
          <Link
            href="/docs"
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--muted)] transition-colors text-[var(--foreground)] font-medium"
          >
            <Book size={20} />
            Documentation
          </Link>
        </nav>

        <div className="p-4 border-t border-[var(--border)] space-y-4">
          <CreditBalance />
          <div className="flex items-center gap-3 px-3 py-2">
            {session.picture ? (
              <img
                src={session.picture as string}
                alt="Avatar"
                className="w-8 h-8 rounded-full"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[var(--foreground)] text-[var(--background)] flex items-center justify-center text-sm font-medium">
                {(session.name as string)?.[0] || "U"}
              </div>
            )}
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-medium truncate">
                {session.name as string}
              </span>
              <span className="text-xs text-[var(--muted-foreground)] truncate">
                {session.email as string}
              </span>
            </div>
          </div>
          <a
            href="/api/auth/logout"
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--muted)] transition-colors text-red-500 font-medium"
          >
            <LogOut size={20} />
            Logout
          </a>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 flex items-center px-6 border-b border-[var(--border)] bg-[var(--card)] md:hidden">
          <span className="text-xl font-semibold tracking-tight">RAG SaaS</span>
        </header>
        <div className="md:hidden p-4 border-b border-[var(--border)] bg-[var(--card)]">
          <CreditBalance />
        </div>
        <div className="flex-1 overflow-auto p-6 md:p-10">
          <div className="max-w-5xl mx-auto">{children}</div>
        </div>
      </main>
    </div>
    </CreditProvider>
  );
}
