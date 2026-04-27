"use client";

import { useState, useEffect } from "react";
import { UploadCloud, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { useRouter } from "next/navigation";

export default function FileUpload({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [models, setModels] = useState<{ name: string; displayName: string }[]>(
    [],
  );
  const [selectedModel, setSelectedModel] =
    useState<string>("text-embedding-004");
  const [modelsLoading, setModelsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/models")
      .then((res) => res.json())
      .then((data) => {
        if (data.models && data.models.length > 0) {
          setModels(data.models);
          setSelectedModel(data.models[0].name);
        }
      })
      .catch((err) => console.error("Failed to load models", err))
      .finally(() => setModelsLoading(false));
  }, []);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const getProgressLabel = () => {
    if (uploadProgress < 85) return "Uploading...";
    if (uploadProgress < 100) return "Processing embeddings...";
    return "Done!";
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      setProcessing(false);
      setError("");
      setSuccess("");
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
              setUploadProgress(90);
              setProcessing(true);
              JSON.parse(xhr.responseText);

              setUploadProgress(100);
              setProcessing(false);
              setSuccess("Document uploaded and processed successfully!");
              e.target.value = "";

              setTimeout(() => {
                setUploadProgress(0);
                setLoading(false);
                router.refresh();
              }, 1500);

              resolve(null);
            } catch (err: any) {
              setError("Processing failed. Please try again.");
              setUploadProgress(0);
              setProcessing(false);
              setLoading(false);
              reject(err);
            }
          } else {
            let errorMsg = "Upload failed. Please try again.";
            try {
              const parsed = JSON.parse(xhr.responseText);
              if (parsed?.error) errorMsg = parsed.error;
            } catch {
              // non-JSON response, use default
            }
            setError(errorMsg);
            setUploadProgress(0);
            setLoading(false);
            reject(new Error(errorMsg));
          }
        });

        xhr.addEventListener("error", () => {
          setError("Network error. Please check your connection and try again.");
          setUploadProgress(0);
          setLoading(false);
          reject(new Error("Upload error"));
        });

        xhr.addEventListener("abort", () => {
          setError("Upload was cancelled.");
          setUploadProgress(0);
          setLoading(false);
          reject(new Error("Upload cancelled"));
        });

        xhr.open("POST", "/api/upload");
        xhr.send(formData);
      });
    } catch (err: any) {
      setError(err.message || "Upload failed. Please try again.");
      setUploadProgress(0);
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center p-8 border-2 border-dashed border-[var(--border)] rounded-lg bg-[var(--background)]">
      <div className="text-center w-full">
        <UploadCloud className="mx-auto mb-4 h-10 w-10 text-[var(--muted-foreground)]" />

        <h3 className="font-medium text-lg">Upload Documents</h3>
        <p className="text-[var(--muted-foreground)] text-sm mb-4">
          PDF, DOCX, TXT, or MD
        </p>

        {modelsLoading ? (
          <Loader2 className="animate-spin h-5 w-5 mb-4 text-[var(--muted-foreground)]" />
        ) : (
          <div className="mb-4 text-left w-full max-w-[250px]">
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
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

        {error && (
          <div className="flex items-center gap-2 text-red-500 text-sm mb-4 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg w-full">
            <AlertCircle size={16} className="flex-shrink-0" />
            <span className="text-left">{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 text-green-600 text-sm mb-4 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg w-full">
            <CheckCircle size={16} className="flex-shrink-0" />
            <span className="text-left">{success}</span>
          </div>
        )}

        {loading && (
          <div className="w-full mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-[var(--muted-foreground)]">
                {getProgressLabel()}
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
            {processing && (
              <p className="text-xs text-[var(--muted-foreground)] mt-1 text-center">
                Generating embeddings, this may take a moment...
              </p>
            )}
          </div>
        )}

        <label className="cursor-pointer bg-[var(--foreground)] text-[var(--background)] px-6 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
          {loading ? "Uploading..." : "Choose File"}
          <input
            type="file"
            className="hidden"
            accept=".pdf,.txt,.docx,.md,.json"
            onChange={handleUpload}
            disabled={loading || modelsLoading}
          />
        </label>
        {!loading && (
          <p className="text-xs text-[var(--muted-foreground)] mt-2">
            PDF, DOCX, TXT, MD, or JSON
          </p>
        )}
      </div>
    </div>
  );
}
