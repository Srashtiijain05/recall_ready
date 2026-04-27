module.exports=[93695,(a,b,c)=>{b.exports=a.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},26758,a=>{a.v("/_next/static/media/favicon.0x3dzn~oxb6tn.ico"+(globalThis.NEXT_CLIENT_ASSET_SUFFIX||""))},38872,a=>{"use strict";let b={src:a.i(26758).default,width:256,height:256};a.s(["default",0,b])},2194,a=>{"use strict";var b=a.i(7997),c=a.i(9223);a.i(70396);var d=a.i(73727);async function e(){return await (0,c.getSession)()||(0,d.redirect)("/"),(0,b.jsxs)("div",{className:"space-y-8 max-w-3xl pb-20",children:[(0,b.jsxs)("div",{children:[(0,b.jsx)("h1",{className:"text-3xl font-bold tracking-tight",children:"Documentation"}),(0,b.jsx)("p",{className:"text-[var(--muted-foreground)] mt-2",children:"Learn how to configure and use your RAG Workspace."})]}),(0,b.jsxs)("div",{className:"space-y-12",children:[(0,b.jsxs)("section",{id:"supabase-setup",className:"space-y-4",children:[(0,b.jsx)("h2",{className:"text-2xl font-semibold tracking-tight border-b border-[var(--border)] pb-2",children:"1. Supabase Setup Guide"}),(0,b.jsxs)("div",{className:"prose prose-sm dark:prose-invert",children:[(0,b.jsx)("p",{children:"To use this platform securely, you must configure a Supabase pgvector database for storing your embeddings."}),(0,b.jsxs)("ol",{className:"list-decimal pl-5 space-y-2",children:[(0,b.jsxs)("li",{children:["Go to"," ",(0,b.jsx)("a",{href:"https://database.new",target:"_blank",className:"text-[var(--accent)] hover:underline",children:"database.new"})," ","to create a new Supabase project."]}),(0,b.jsx)("li",{children:"Wait for the database to provision."}),(0,b.jsxs)("li",{children:["Navigate to ",(0,b.jsx)("strong",{children:"Project Settings -> API"}),"."]}),(0,b.jsxs)("li",{children:["Copy the ",(0,b.jsx)("strong",{children:"Project URL"})," and"," ",(0,b.jsx)("strong",{children:"Service Role Key"}),". (Never expose the Service Role key to end-users)."]}),(0,b.jsxs)("li",{children:["Paste these keys into the"," ",(0,b.jsx)("a",{href:"/settings",className:"text-[var(--accent)] hover:underline",children:"Settings"})," ","page."]}),(0,b.jsxs)("li",{children:["Go to ",(0,b.jsx)("strong",{children:"SQL Editor"})," in Supabase and run the following schema:"]})]}),(0,b.jsx)("pre",{className:"bg-[var(--muted)] p-4 rounded-lg overflow-x-auto text-xs mt-4",children:`-- Enable pgvector
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
$$;`})]})]}),(0,b.jsxs)("section",{id:"gemini-setup",className:"space-y-4",children:[(0,b.jsx)("h2",{className:"text-2xl font-semibold tracking-tight border-b border-[var(--border)] pb-2",children:"2. Gemini API Setup Guide"}),(0,b.jsx)("div",{className:"prose prose-sm dark:prose-invert",children:(0,b.jsxs)("ol",{className:"list-decimal pl-5 space-y-2",children:[(0,b.jsxs)("li",{children:["Go to"," ",(0,b.jsx)("a",{href:"https://aistudio.google.com/",target:"_blank",className:"text-[var(--accent)] hover:underline",children:"Google AI Studio"}),"."]}),(0,b.jsx)("li",{children:"Sign in with your Google account."}),(0,b.jsxs)("li",{children:["Click ",(0,b.jsx)("strong",{children:"Get API key"})," in the left sidebar."]}),(0,b.jsxs)("li",{children:["Click ",(0,b.jsx)("strong",{children:"Create API key"})," and generate a key for a new project."]}),(0,b.jsxs)("li",{children:["Copy the generated key and paste it into the"," ",(0,b.jsx)("a",{href:"/settings",className:"text-[var(--accent)] hover:underline",children:"Settings"})," ","page."]})]})})]}),(0,b.jsxs)("section",{id:"usage-guide",className:"space-y-4",children:[(0,b.jsx)("h2",{className:"text-2xl font-semibold tracking-tight border-b border-[var(--border)] pb-2",children:"3. Product Usage Guide"}),(0,b.jsx)("div",{className:"prose prose-sm dark:prose-invert",children:(0,b.jsxs)("ul",{className:"list-disc pl-5 space-y-2",children:[(0,b.jsxs)("li",{children:[(0,b.jsx)("strong",{children:"Creating a Project"}),': Go to Projects and click "Create". This creates a fully isolated environment for a specific knowledge base.']}),(0,b.jsxs)("li",{children:[(0,b.jsx)("strong",{children:"Uploading Documents"}),": Inside a project, use the File Uploader to upload PDF, TXT, or DOCX files. The backend will parse the text and split it into logical chunks."]}),(0,b.jsxs)("li",{children:[(0,b.jsx)("strong",{children:"Embeddings"}),": When you upload a file, the platform automatically calls the"," ",(0,b.jsx)("code",{children:"gemini-text-embedding-004"})," model to convert the text chunks into vectors and stores them in your Supabase database linked to the project ID."]}),(0,b.jsxs)("li",{children:[(0,b.jsx)("strong",{children:"Querying"}),": Open the Chat interface on the right side of your project workspace. Type a question. The platform will execute a Semantic Search (vector similarity) in Supabase to find related chunks."]}),(0,b.jsxs)("li",{children:[(0,b.jsx)("strong",{children:"Generation"}),": The relevant chunks are passed to the ",(0,b.jsx)("code",{children:"gemini-1.5-flash"})," model alongside your question to generate a highly accurate, grounded answer in real time."]})]})})]})]})]})}a.s(["default",0,e])},53514,a=>{a.n(a.i(2194))}];

//# sourceMappingURL=%5Broot-of-the-server%5D__0cl01ty._.js.map