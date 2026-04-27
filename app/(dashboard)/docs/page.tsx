import React from "react";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DocsPage() {
  const session = await getSession();
  if (!session) redirect("/");

  return (
    <div className="space-y-8 max-w-3xl pb-20">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Documentation</h1>
        <p className="text-[var(--muted-foreground)] mt-2">
          Learn how to configure and use your RAG Workspace.
        </p>
      </div>

      <div className="space-y-12">
        {/* Supabase Guide */}
        <section id="supabase-setup" className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight border-b border-[var(--border)] pb-2">
            1. Supabase Setup Guide
          </h2>
          <div className="prose prose-sm dark:prose-invert">
            <p>
              To use this platform securely, you must configure a Supabase
              pgvector database for storing your embeddings.
            </p>
            <ol className="list-decimal pl-5 space-y-2">
              <li>
                Go to{" "}
                <a
                  href="https://database.new"
                  target="_blank"
                  className="text-[var(--accent)] hover:underline"
                >
                  database.new
                </a>{" "}
                to create a new Supabase project.
              </li>
              <li>Wait for the database to provision.</li>
              <li>
                Navigate to <strong>Project Settings -&gt; API</strong>.
              </li>
              <li>
                Copy the <strong>Project URL</strong> and{" "}
                <strong>Service Role Key</strong>. (Never expose the Service
                Role key to end-users).
              </li>
              <li>
                Paste these keys into the{" "}
                <a
                  href="/settings"
                  className="text-[var(--accent)] hover:underline"
                >
                  Settings
                </a>{" "}
                page.
              </li>
              <li>
                Go to <strong>SQL Editor</strong> in Supabase and run the
                following schema:
              </li>
            </ol>
            <pre className="bg-[var(--muted)] p-4 rounded-lg overflow-x-auto text-xs mt-4">
              {`-- Enable pgvector
create extension if not exists vector;

-- Create table
create table document_chunks (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  document_id text not null,
  content text not null,
  embedding vector(3072)
);

-- Search function
create or replace function match_document_chunks (
  query_embedding vector(3072),
  match_threshold float,
  match_count int,
  p_project_id text
)
returns table (
  id uuid,
  document_id text,
  content text,
  similarity float
)
language sql stable
as $$
  select
    document_chunks.id,
    document_chunks.document_id,
    document_chunks.content,
    1 - (document_chunks.embedding <=> query_embedding) as similarity
  from document_chunks
  where document_chunks.project_id = p_project_id
    and 1 - (document_chunks.embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
$$;`}
            </pre>
          </div>
        </section>

        {/* Gemini Guide */}
        <section id="gemini-setup" className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight border-b border-[var(--border)] pb-2">
            2. Gemini API Setup Guide
          </h2>
          <div className="prose prose-sm dark:prose-invert">
            <ol className="list-decimal pl-5 space-y-2">
              <li>
                Go to{" "}
                <a
                  href="https://aistudio.google.com/"
                  target="_blank"
                  className="text-[var(--accent)] hover:underline"
                >
                  Google AI Studio
                </a>
                .
              </li>
              <li>Sign in with your Google account.</li>
              <li>
                Click <strong>Get API key</strong> in the left sidebar.
              </li>
              <li>
                Click <strong>Create API key</strong> and generate a key for a
                new project.
              </li>
              <li>
                Copy the generated key and paste it into the{" "}
                <a
                  href="/settings"
                  className="text-[var(--accent)] hover:underline"
                >
                  Settings
                </a>{" "}
                page.
              </li>
            </ol>
          </div>
        </section>

        {/* Usage Guide */}
        <section id="usage-guide" className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight border-b border-[var(--border)] pb-2">
            3. Product Usage Guide
          </h2>
          <div className="prose prose-sm dark:prose-invert">
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Creating a Project</strong>: Go to Projects and click
                "Create". This creates a fully isolated environment for a
                specific knowledge base.
              </li>
              <li>
                <strong>Uploading Documents</strong>: Inside a project, use the
                File Uploader to upload PDF, TXT, or DOCX files. The backend
                will parse the text and split it into logical chunks.
              </li>
              <li>
                <strong>Embeddings</strong>: When you upload a file, the
                platform automatically calls the{" "}
                <code>gemini-text-embedding-004</code> model to convert the text
                chunks into vectors and stores them in your Supabase database
                linked to the project ID.
              </li>
              <li>
                <strong>Querying</strong>: Open the Chat interface on the right
                side of your project workspace. Type a question. The platform
                will execute a Semantic Search (vector similarity) in Supabase
                to find related chunks.
              </li>
              <li>
                <strong>Generation</strong>: The relevant chunks are passed to
                the <code>gemini-1.5-flash</code> model alongside your question
                to generate a highly accurate, grounded answer in real time.
              </li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
