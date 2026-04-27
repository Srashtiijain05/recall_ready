"use client";

import { useState, useEffect } from "react";
import { FileUp, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCredits } from "@/components/CreditProvider";

interface UploadMenuProps {
  projectId: string;
  onUploadSuccess: () => void;
}

export default function UploadMenu({
  projectId,
  onUploadSuccess,
}: UploadMenuProps) {
  const router = useRouter();
  const { refresh } = useCredits();
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const [models, setModels] = useState<{ name: string; displayName: string }[]>(
    [],
  );
  const [selectedModel, setSelectedModel] =
    useState<string>("text-embedding-004");
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState("");

  // Load available models on component mount
  useEffect(() => {
    const loadModels = async () => {
      try {
        setModelsError("");
        const res = await fetch("/api/models");

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(
            errorData.error || `Failed to load models (${res.status})`,
          );
        }

        const data = await res.json();
        if (data.models && data.models.length > 0) {
          setModels(data.models);
          setSelectedModel(data.models[0].name);
        } else {
          throw new Error("No models available");
        }
      } catch (err: any) {
        setModelsError(err.message || "Failed to load embedding models");
        setModels([]);
        setSelectedModel("");
        console.error("Failed to load models", err);
      } finally {
        setModelsLoading(false);
      }
    };

    loadModels();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      setError("");
      setUploadProgress(0);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("embeddingModel", selectedModel);
      formData.append("projectId", projectId);

      const xhr = new XMLHttpRequest();

      return new Promise((resolve, reject) => {
        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round(
              (event.loaded / event.total) * 85,
            );
            setUploadProgress(percentComplete);
          }
        });

        xhr.addEventListener("load", async () => {
          if (xhr.status === 200) {
            try {
              setUploadProgress(100);
              e.target.value = "";

              setTimeout(() => {
                setUploadProgress(0);
                setLoading(false);
                onUploadSuccess();
                refresh();
                router.refresh();
              }, 1500);

              resolve(null);
            } catch (err: any) {
              setError(err.message || "Processing failed");
              setUploadProgress(0);
              setLoading(false);
              reject(err);
            }
          } else {
            const error = xhr.responseText || "Upload failed";
            setError(error);
            setUploadProgress(0);
            setLoading(false);
            reject(new Error(error));
          }
        });

        xhr.addEventListener("error", () => {
          setError("Upload error occurred");
          setUploadProgress(0);
          setLoading(false);
          reject(new Error("Upload error"));
        });

        xhr.open("POST", "/api/upload");
        xhr.send(formData);
      });
    } catch (err: any) {
      setError(err.message || "Upload failed");
      setUploadProgress(0);
      setLoading(false);
    }
  };

  return (
    <div className="absolute bottom-14 left-0 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-lg p-4 min-w-[300px] z-50">
      {/* Models Loading State */}
      {modelsLoading && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-start gap-2">
          <div className="animate-spin h-4 w-4 rounded-full border-2 border-blue-500 border-t-transparent flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-600 dark:text-blue-400">
            Loading models...
          </p>
        </div>
      )}

      {/* Models Error State */}
      {modelsError && !modelsLoading && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex flex-col gap-2">
          <div className="flex items-start gap-2">
            <XCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-600 dark:text-red-400">
              {modelsError}
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="text-xs px-2 py-1 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 text-red-700 dark:text-red-300 rounded transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Model Selection */}
      {!modelsLoading && !modelsError && models.length > 0 && (
        <div className="mb-4">
          <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-2">
            Embedding Model
          </label>
          <select
            className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--foreground)] outline-none"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            disabled={loading}
          >
            {models.map((m) => (
              <option key={m.name} value={m.name}>
                {m.displayName}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Upload Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
          <XCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Upload Progress */}
      {loading && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[var(--muted-foreground)]">
              {uploadProgress < 100 ? "Uploading..." : "Processing..."}
            </span>
            <span className="text-xs font-medium text-[var(--muted-foreground)]">
              {uploadProgress}%
            </span>
          </div>
          <div className="w-full bg-[var(--border)] rounded-full h-2 overflow-hidden">
            <div
              className="bg-[var(--foreground)] h-full transition-all duration-300 ease-out"
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* File Input Button */}
      <label
        className={`cursor-pointer block w-full bg-[var(--foreground)] text-[var(--background)] px-4 py-2 rounded-lg text-sm font-medium text-center transition-opacity ${
          loading || modelsLoading || modelsError
            ? "opacity-50 cursor-not-allowed"
            : "hover:opacity-90"
        }`}
      >
        {modelsLoading
          ? "Loading models..."
          : modelsError
            ? "Models unavailable"
            : "Choose File"}
        <input
          type="file"
          className="hidden"
          accept=".pdf,.txt,.docx,.md,.json"
          onChange={handleUpload}
          disabled={loading || modelsLoading || !!modelsError}
        />
      </label>

      <p className="text-xs text-[var(--muted-foreground)] mt-2 text-center">
        PDF, DOCX, TXT, MD, or JSON
      </p>
    </div>
  );
}
