-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Create a table to store your documents
create table document_chunks (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  document_id text not null,
  content text not null,
  embedding vector(3072),
  metadata jsonb,
  created_at timestamptz default now()
);

-- Create a function to search for documents
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
  similarity float,
  metadata jsonb
)
language sql stable
as $$
  select
    document_chunks.id,
    document_chunks.document_id,
    document_chunks.content,
    1 - (document_chunks.embedding <=> query_embedding) as similarity,
    document_chunks.metadata
  from document_chunks
  where document_chunks.project_id = p_project_id
    and 1 - (document_chunks.embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
$$;
