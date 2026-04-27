import mongoose from "mongoose";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb/connect";
import { redirect } from "next/navigation";
import { UserSettings } from "@/models/UserSettings";
import { saveSettings } from "./actions";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/");

  await connectToDatabase();
  const settings = await UserSettings.findOne({
    userId: new mongoose.Types.ObjectId(String(session.id)),
  }).lean();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-[var(--muted-foreground)] mt-2">
          Manage your API keys and vector database connections.
        </p>
      </div>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-8 max-w-2xl shadow-sm">
        <form
          action={async (formData) => {
            "use server";
            await saveSettings(formData);
          }}
          className="space-y-6"
        >
          <div className="space-y-2">
            <h3 className="text-xl font-semibold tracking-tight">
              Gemini API Configuration
            </h3>
            <p className="text-sm text-[var(--muted-foreground)] pb-2">
              Used for generating embeddings and RAG summaries.
            </p>
            <div>
              <label className="block text-sm font-medium mb-1">
                Gemini API Key
              </label>
              <input
                name="geminiApiKey"
                type="password"
                defaultValue={settings?.geminiApiKey || ""}
                placeholder="AIzaSy..."
                className="w-full px-4 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--foreground)] transition-all font-mono"
              />
            </div>
          </div>

          <div className="pt-6 border-t border-[var(--border)] space-y-2">
            <h3 className="text-xl font-semibold tracking-tight">
              Supabase (Vector Store) Configuration
            </h3>
            <p className="text-sm text-[var(--muted-foreground)] pb-2">
              Provide the credentials for the Supabase instance where pgvector
              is enabled.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Supabase Project URL
                </label>
                <input
                  name="supabaseUrl"
                  type="url"
                  defaultValue={settings?.supabaseUrl || ""}
                  placeholder="https://xxxxx.supabase.co"
                  className="w-full px-4 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--foreground)] transition-all font-mono"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Supabase Service Role Key
                </label>
                <input
                  name="supabaseServiceKey"
                  type="password"
                  defaultValue={settings?.supabaseServiceKey || ""}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR..."
                  className="w-full px-4 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--foreground)] transition-all font-mono"
                />
                <p className="text-xs text-[var(--muted-foreground)] mt-2">
                  Required for bypassing RLS to insert and query embeddings
                  securely on the backend.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-6">
            <button
              type="submit"
              className="bg-[var(--foreground)] text-[var(--background)] px-6 py-2.5 rounded-lg text-sm font-medium hover:scale-[1.02] transition-transform"
            >
              Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
