import mongoose from "mongoose";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb/connect";
import { Project } from "@/models/Project";
import { Doc } from "@/models/Document";
import { Chat as ChatModel } from "@/models/Chat";
import { redirect } from "next/navigation";
import Chat from "@/components/Chat";
import ChatItem from "@/components/ChatItem";
import { Plus } from "lucide-react";
import Link from "next/link";
import { createChat, getOrCreateDefaultChat } from "./actions";

// Helper function to serialize MongoDB documents
function serializeDocument(doc: any) {
  return {
    _id: doc._id?.toString() || doc._id,
    projectId: doc.projectId?.toString() || doc.projectId,
    userId: doc.userId?.toString() || doc.userId,
    fileName: doc.fileName,
    fileType: doc.fileType,
    createdAt: doc.createdAt,
    __v: doc.__v,
  };
}

export default async function ProjectWorkspace({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const queryParams = await searchParams;
  const selectedChatId = queryParams.chat as string | undefined;
  const session = await getSession();
  if (!session) redirect("/");

  await connectToDatabase();

  const project = await Project.findOne({
    _id: new mongoose.Types.ObjectId(id),
    userId: new mongoose.Types.ObjectId(String(session.id)),
  }).lean();
  if (!project) redirect("/projects");

  const documents = await Doc.find({ projectId: id })
    .sort({ createdAt: -1 })
    .lean();

  // Fetch or create default chat
  const defaultChat = await getOrCreateDefaultChat(id);
  const chats = await ChatModel.find({
    projectId: id,
    userId: new mongoose.Types.ObjectId(String(session.id)),
  })
    .sort({ updatedAt: -1 })
    .lean();

  // Use selected chat from URL params, or default chat
  const activeChatId = selectedChatId || defaultChat._id.toString();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-[var(--border)] pb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)] mb-1">
            <Link href="/projects" className="hover:underline">
              Projects
            </Link>
            <span>/</span>
            <span>{project.name}</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            {project.name} Workspace
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Chats */}
        <div className="lg:col-span-1 space-y-6 flex flex-col">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg text-[var(--foreground)]">
                Chats
              </h3>
              <form
                action={async () => {
                  "use server";
                  await createChat(id, `Chat #${chats.length + 1}`);
                }}
              >
                <button
                  type="submit"
                  className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors p-1.5 rounded-lg hover:bg-[var(--muted)]"
                  title="New chat"
                >
                  <Plus size={18} />
                </button>
              </form>
            </div>

            <div className="space-y-2">
              {chats.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)]">
                  No chats yet
                </p>
              ) : (
                chats.map((chat: any) => (
                  <ChatItem
                    key={chat._id.toString()}
                    chat={{ _id: chat._id.toString(), title: chat.title }}
                    projectId={id}
                    isActive={chat._id.toString() === activeChatId}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: RAG Chat */}
        <div className="lg:col-span-2">
          <Chat
            projectId={id}
            chatId={activeChatId}
            initialDocuments={documents.map(serializeDocument)}
          />
        </div>
      </div>
    </div>
  );
}
