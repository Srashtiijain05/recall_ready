"use client";

import { useState } from "react";
import { Trash2, Edit2, Check, X } from "lucide-react";
import {
  deleteChat,
  renameChat,
} from "@/app/(dashboard)/projects/[id]/actions";

export default function ChatItem({
  chat,
  projectId,
  isActive,
}: {
  chat: { _id: string; title: string };
  projectId: string;
  isActive?: boolean;
}) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState(chat.title);
  const [submitting, setSubmitting] = useState(false);

  const handleRename = async () => {
    if (!newTitle.trim() || newTitle === chat.title) {
      setIsRenaming(false);
      setNewTitle(chat.title);
      return;
    }

    try {
      setSubmitting(true);
      await renameChat(projectId, chat._id, newTitle);
      setIsRenaming(false);
    } catch (err) {
      console.error("Rename error:", err);
      setNewTitle(chat.title);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (confirm("Are you sure you want to delete this chat?")) {
      try {
        await deleteChat(projectId, chat._id);
      } catch (err) {
        console.error("Delete error:", err);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleRename();
    } else if (e.key === "Escape") {
      setIsRenaming(false);
      setNewTitle(chat.title);
    }
  };

  return (
    <div className="flex items-center justify-between p-2 rounded-lg hover:bg-[var(--muted)] group">
      {isRenaming ? (
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          className="flex-1 text-sm bg-[var(--background)] border border-[var(--border)] rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[var(--foreground)]"
          disabled={submitting}
        />
      ) : (
        <a
          href={`?chat=${chat._id}`}
          className={`flex-1 text-sm truncate transition-colors ${
            isActive
              ? "text-[var(--foreground)] font-medium"
              : "text-[var(--foreground)] hover:underline"
          }`}
          title={chat.title}
        >
          {chat.title}
        </a>
      )}

      <div className="flex items-center gap-1 shrink-0">
        {isRenaming ? (
          <>
            <button
              onClick={handleRename}
              disabled={submitting}
              className="text-[var(--muted-foreground)] hover:text-green-600 transition-colors p-1 rounded disabled:opacity-50"
              title="Confirm rename"
            >
              <Check size={14} />
            </button>
            <button
              onClick={() => {
                setIsRenaming(false);
                setNewTitle(chat.title);
              }}
              disabled={submitting}
              className="text-[var(--muted-foreground)] hover:text-red-500 transition-colors p-1 rounded disabled:opacity-50"
              title="Cancel"
            >
              <X size={14} />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setIsRenaming(true)}
              className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors p-1 rounded opacity-0 group-hover:opacity-100"
              title="Rename chat"
            >
              <Edit2 size={14} />
            </button>
            <button
              onClick={handleDelete}
              className="text-[var(--muted-foreground)] hover:text-red-500 transition-colors p-1 rounded opacity-0 group-hover:opacity-100"
              title="Delete chat"
            >
              <Trash2 size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
