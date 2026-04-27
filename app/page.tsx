import Link from "next/link";
import { ArrowRight, Database, Shield, Zap } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col items-center justify-center p-8">
      <main className="max-w-5xl mx-auto flex flex-col items-center text-center space-y-12">
        {/* Hero Section */}
        <div className="space-y-6">
          <h1 className="text-5xl md:text-7xl font-semibold tracking-tight text-[var(--foreground)]">
            Your Brain,
            <br className="hidden md:block" /> Powered by Gemini.
          </h1>
          <p className="text-xl md:text-2xl text-[var(--muted-foreground)] max-w-2xl mx-auto font-medium">
            Build a semantic search knowledge base in seconds. Connect your
            data, get insights.
          </p>
        </div>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
          <Link
            href="/signup"
            className="flex items-center gap-2 bg-[var(--foreground)] text-[var(--background)] px-8 py-4 rounded-full text-lg font-medium hover:scale-[1.02] transition-transform shadow-lg"
          >
            Start for free
            <ArrowRight size={20} />
          </Link>
          <Link
            href="/docs"
            className="flex items-center gap-2 bg-[var(--muted)] text-[var(--foreground)] px-8 py-4 rounded-full text-lg font-medium hover:bg-[var(--border)] transition-colors"
          >
            Read the docs
          </Link>
          <Link
            href="/signin"
            className="text-[var(--foreground)] px-6 py-3 text-lg font-medium hover:text-[var(--muted-foreground)] transition-colors"
          >
            Sign in
          </Link>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-16 w-full text-left">
          <FeatureCard
            icon={<Zap className="w-8 h-8 text-[var(--foreground)]" />}
            title="Lightning Fast RAG"
            description="Powered by Gemini text-embedding-004 and Supabase pgvector."
          />
          <FeatureCard
            icon={<Shield className="w-8 h-8 text-[var(--foreground)]" />}
            title="Complete Isolation"
            description="architecture ensuring isolated data and embeddings for every user."
          />
          <FeatureCard
            icon={<Database className="w-8 h-8 text-[var(--foreground)]" />}
            title="Bring Your Own DB"
            description="Flexible settings allow you to securely plug in your own Supabase credentials."
          />
        </div>
      </main>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="p-8 rounded-[2rem] bg-[var(--card)] border border-[var(--border)] shadow-sm hover:shadow-md transition-shadow">
      <div className="bg-[var(--muted)] w-16 h-16 rounded-full flex items-center justify-center mb-6">
        {icon}
      </div>
      <h3 className="text-2xl font-semibold mb-3 tracking-tight">{title}</h3>
      <p className="text-[var(--muted-foreground)] leading-relaxed">
        {description}
      </p>
    </div>
  );
}
