"use client";

import { useState } from "react";
import { FileText, Trash2, X } from "lucide-react";

interface UploadedDocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  documents: any[];
  projectId: string;
  onDocumentDeleted: () => void;
}

export default function UploadedDocumentsModal({
  isOpen,
  onClose,
  documents,
  projectId,
  onDocumentDeleted,
}: UploadedDocumentsModalProps) {
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (docId: string, fileName: string) => {
    if (!confirm(`Delete "${fileName}"?`)) return;

    setDeleting(docId);
    try {
      const response = await fetch("/api/documents", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, documentId: docId }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete document");
      }

      onDocumentDeleted();
    } catch (error) {
      console.error("Failed to delete document:", error);
      alert("Failed to delete document");
    } finally {
      setDeleting(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--border)] bg-[var(--muted)]">
          <h2 className="text-xl font-semibold text-[var(--foreground)]">
            Uploaded Documents {documents.length > 0 && `(${documents.length})`}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--background)] rounded-lg transition-colors"
          >
            <X size={20} className="text-[var(--muted-foreground)]" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {documents.length === 0 ? (
            <p className="text-center text-[var(--muted-foreground)] py-12">
              No documents uploaded yet
            </p>
          ) : (
            <div className="space-y-3">
              {documents.map((doc: any) => (
                <div
                  key={doc._id.toString()}
                  className="flex items-center justify-between p-4 bg-[var(--background)] border border-[var(--border)] rounded-lg hover:border-[var(--foreground)] transition-colors group"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileText
                      className="text-[var(--accent)] flex-shrink-0"
                      size={20}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate text-[var(--foreground)]">
                        {doc.fileName}
                      </p>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      handleDelete(doc._id.toString(), doc.fileName)
                    }
                    disabled={deleting === doc._id.toString()}
                    className="ml-4 p-2 text-[var(--muted-foreground)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
