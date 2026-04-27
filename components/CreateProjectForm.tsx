"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { createProject } from "@/app/(dashboard)/projects/actions";
import { useCredits } from "@/components/CreditProvider";

export default function CreateProjectForm() {
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();
  const { refresh } = useCredits();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isPending) return;

    startTransition(async () => {
      try {
        await createProject(new FormData(e.target as HTMLFormElement));
        setName("");
        await refresh(); // Refresh credits after successful creation
      } catch (error) {
        // Error is handled by the server action
        console.error("Failed to create project:", error);
      }
    });
  };

  return (
    <div className="p-6 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-sm flex flex-col justify-center items-center text-center space-y-4 hover:border-[var(--foreground)] transition-colors min-h-[200px]">
      <div className="h-12 w-12 rounded-full bg-[var(--muted)] flex items-center justify-center text-[var(--foreground)]">
        <Plus size={24} />
      </div>
      <div>
        <h3 className="font-semibold text-lg">New Project</h3>
        <p className="text-sm text-[var(--muted-foreground)]">
          Create a new isolated knowledge base.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="w-full flex mt-2 gap-2">
        <input
          name="name"
          type="text"
          placeholder="Project name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          disabled={isPending}
          className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--foreground)] focus:border-transparent transition-all disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isPending || !name.trim()}
          className="bg-[var(--foreground)] text-[var(--background)] px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "Creating..." : "Create"}
        </button>
      </form>
    </div>
  );
}