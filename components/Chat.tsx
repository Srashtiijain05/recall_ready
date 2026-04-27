"use client";

import { useState, useEffect } from "react";
import { Send, User as UserIcon, Bot, Loader2, FileUp } from "lucide-react";
import UploadMenu from "./UploadMenu";
import UploadedDocumentsModal from "./UploadedDocumentsModal";
import { useCredits } from "@/components/CreditProvider";

export default function Chat({
  projectId,
  chatId,
  initialDocuments = [],
}: {
  projectId: string;
  chatId: string;
  initialDocuments?: any[];
}) {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const [showDocumentsModal, setShowDocumentsModal] = useState(false);
  const [documents, setDocuments] = useState(initialDocuments);

  const { refresh } = useCredits();

  // Load chat messages on mount or when chatId changes
  useEffect(() => {
    const loadChat = async () => {
      try {
        const res = await fetch(`/api/chat/${chatId}`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages || []);
        }
      } catch (err) {
        console.error("Failed to load chat:", err);
      } finally {
        setInitialLoading(false);
      }
    };

    loadChat();
  }, [chatId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || loading) return;

    const userMessage = { role: "user" as const, content: query };
    setMessages((prev) => [...prev, userMessage]);
    setQuery("");
    setLoading(true);

    try {
      const res = await fetch(`/api/v1/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, message: query, chat_id: chatId }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || "Failed to fetch response");
      }

      const data = await res.json();
      const assistantMessage = {
        role: "assistant" as const,
        content: data.data?.answer || "No response received",
      };
      setMessages((prev) => [...prev, assistantMessage]);
      await refresh();
    } catch (err: any) {
      const errorMessage = {
        role: "assistant" as const,
        content: `Error: ${err.message}`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadSuccess = () => {
    setShowUploadMenu(false);
    // Refresh documents list
    fetch(`/api/documents?projectId=${projectId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.documents) {
          setDocuments(data.documents);
        }
      })
      .catch(console.error);
  };

  const handleDocumentDeleted = () => {
    // Refresh documents
    fetch(`/api/documents?projectId=${projectId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.documents) {
          setDocuments(data.documents);
        }
      })
      .catch(console.error);
  };

  return (
    <div className="flex flex-col h-[600px] border border-[var(--border)] rounded-2xl bg-[var(--card)] shadow-sm overflow-hidden">
      <div className="p-4 border-b border-[var(--border)] bg-[var(--muted)]">
        <h3 className="font-semibold px-2">RAG Chat</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {initialLoading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2
              className="animate-spin text-[var(--muted-foreground)]"
              size={24}
            />
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[var(--muted-foreground)]">
            Ask a question based on the uploaded documents.
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="h-8 w-8 shrink-0 rounded-full bg-[var(--foreground)] text-[var(--background)] flex items-center justify-center">
                  <Bot size={16} />
                </div>
              )}
              <div
                className={`px-4 py-2 max-w-[80%] rounded-2xl ${msg.role === "user" ? "bg-[var(--accent)] text-white" : "bg-[var(--muted)] text-[var(--foreground)]"}`}
              >
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {msg.content}
                </p>
              </div>
              {msg.role === "user" && (
                <div className="h-8 w-8 shrink-0 rounded-full bg-[var(--muted)] flex items-center justify-center">
                  <UserIcon size={16} />
                </div>
              )}
            </div>
          ))
        )}
        {loading && (
          <div className="flex gap-3">
            <div className="h-8 w-8 rounded-full bg-[var(--foreground)] text-[var(--background)] flex items-center justify-center">
              <Loader2 className="animate-spin" size={16} />
            </div>
            <div className="px-4 py-2 max-w-[80%] rounded-2xl bg-[var(--muted)] flex items-center text-[var(--foreground)]">
              <span className="flex space-x-1">
                <div className="w-2 h-2 bg-current rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-current rounded-full animate-bounce delay-75"></div>
                <div className="w-2 h-2 bg-current rounded-full animate-bounce delay-150"></div>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-[var(--border)] bg-[var(--background)]">
        <form onSubmit={handleSend} className="relative">
          <div className="flex items-center gap-2">
            {/* File Upload Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowUploadMenu(!showUploadMenu)}
                className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                  showUploadMenu
                    ? "bg-[var(--foreground)] text-[var(--background)]"
                    : "bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--accent)] hover:text-white"
                }`}
              >
                <FileUp size={16} />
              </button>
              {showUploadMenu && (
                <UploadMenu
                  projectId={projectId}
                  onUploadSuccess={handleUploadSuccess}
                />
              )}
            </div>

            {/* Documents Button (Shows if documents exist) */}
            {documents.length > 0 && (
              <button
                type="button"
                onClick={() => setShowDocumentsModal(true)}
                className="h-8 px-2 rounded-full bg-[var(--accent)] text-white text-xs font-medium hover:opacity-90 transition-opacity flex items-center justify-center"
              >
                {documents.length} doc{documents.length !== 1 ? "s" : ""}
              </button>
            )}

            {/* Input Field */}
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask something..."
              className="flex-1 px-4 py-2 bg-[var(--card)] border border-[var(--border)] rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[var(--foreground)] transition-shadow"
            />

            {/* Send Button */}
            <button
              type="submit"
              disabled={loading || !query.trim() || initialLoading}
              className="h-8 w-8 bg-[var(--foreground)] text-[var(--background)] rounded-full flex items-center justify-center disabled:opacity-50 hover:scale-105 transition-transform flex-shrink-0"
            >
              <Send size={14} />
            </button>
          </div>
        </form>
      </div>

      {/* Documents Modal */}
      <UploadedDocumentsModal
        isOpen={showDocumentsModal}
        onClose={() => setShowDocumentsModal(false)}
        documents={documents}
        projectId={projectId}
        onDocumentDeleted={handleDocumentDeleted}
      />
    </div>
  );
}
