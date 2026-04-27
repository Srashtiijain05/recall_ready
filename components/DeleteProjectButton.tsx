"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteProject } from "../app/(dashboard)/projects/actions";
import { useCredits } from "@/components/CreditProvider";

interface DeleteProjectButtonProps {
  projectId: string;
}

export default function DeleteProjectButton({ projectId }: DeleteProjectButtonProps) {
  const [isPending, startTransition] = useTransition();
  const { refresh } = useCredits();

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this project? This action cannot be undone.")) {
      return;
    }

    startTransition(async () => {
      try {
        await deleteProject(projectId);
        await refresh(); // Refresh credits after deletion (in case future refunds)
      } catch (error) {
        console.error("Failed to delete project:", error);
      }
    });
  };

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      className="text-[var(--muted-foreground)] hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
    >
      <Trash2 size={18} />
    </button>
  );
}