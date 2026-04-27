"use server";

import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import { createClient } from "@supabase/supabase-js";
import connectToDatabase from "@/lib/mongodb/connect";
import { Doc } from "@/models/Document";
import { UserSettings } from "@/models/UserSettings";
import { Chat } from "@/models/Chat";
import { getSession } from "@/lib/auth";
import { processAndStoreDocument } from "@/lib/rag/process";

export async function uploadDocument(projectId: string, formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const file = formData.get("file") as File;
  const embeddingModel = (formData.get("embeddingModel") as string) || "gemini-embedding-001";

  if (!file) throw new Error("No file provided");

  await connectToDatabase();

  // Get user settings for credentials
  const settings = await UserSettings.findOne({ userId: new mongoose.Types.ObjectId(String(session.id)) }).lean();
  if (!settings || !settings.geminiApiKey || !settings.supabaseUrl || !settings.supabaseServiceKey) {
    throw new Error("Missing required API keys in Settings");
  }

  // Create a temporary document ID for embedding processing
  const tempDocId = new mongoose.Types.ObjectId().toString();

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Process embeddings FIRST - if this fails, MongoDB document won't be created
  try {
    await processAndStoreDocument(
      buffer,
      file.name,
      file.type || "text/plain",
      projectId,
      session.id as string,
      tempDocId,
      settings.geminiApiKey,
      settings.supabaseUrl,
      settings.supabaseServiceKey,
      embeddingModel
    );
  } catch (err: any) {
    throw new Error(`Failed to process embeddings: ${err.message}`);
  }

  // Only save document reference in MongoDB AFTER embeddings succeed
  try {
    const document = await Doc.create({
      projectId: new mongoose.Types.ObjectId(projectId),
      userId: new mongoose.Types.ObjectId(String(session.id)),
      fileName: file.name,
      fileType: file.type || "text/plain",
    });

    revalidatePath(`/projects/${projectId}`);
    return { success: true, documentId: document._id.toString() };
  } catch (err: any) {
    throw new Error(`Failed to save document metadata: ${err.message}`);
  }
}

export async function deleteDocument(projectId: string, documentId: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  await connectToDatabase();

  // Verify document ownership
  const document = await Doc.findOne({
    _id: new mongoose.Types.ObjectId(documentId),
    projectId: new mongoose.Types.ObjectId(projectId),
    userId: new mongoose.Types.ObjectId(String(session.id)),
  });

  if (!document) throw new Error("Document not found");

  // Get Supabase credentials from settings
  const settings = await UserSettings.findOne({
    userId: new mongoose.Types.ObjectId(String(session.id)),
  }).lean();

  if (!settings || !settings.supabaseUrl || !settings.supabaseServiceKey) {
    throw new Error("Missing Supabase credentials in Settings");
  }

  // Delete chunks from Supabase
  const supabase = createClient(
    settings.supabaseUrl,
    settings.supabaseServiceKey
  );

  const { error: supabaseError } = await supabase
    .from("document_chunks")
    .delete()
    .eq("document_id", documentId);

  if (supabaseError) {
    console.error("Error deleting chunks from Supabase:", supabaseError);
    throw new Error("Failed to delete document chunks");
  }

  // Delete document from MongoDB
  await Doc.deleteOne({ _id: new mongoose.Types.ObjectId(documentId) });

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

export async function resetProject(projectId: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  await connectToDatabase();

  // Verify project ownership
  const project = await Doc.findOne({
    projectId: new mongoose.Types.ObjectId(projectId),
    userId: new mongoose.Types.ObjectId(String(session.id)),
  });

  if (!project) throw new Error("Project not found");

  // Get all document IDs in this project
  const documents = await Doc.find({ projectId: new mongoose.Types.ObjectId(projectId) });

  // Get Supabase credentials
  const settings = await UserSettings.findOne({
    userId: new mongoose.Types.ObjectId(String(session.id)),
  }).lean();

  if (!settings || !settings.supabaseUrl || !settings.supabaseServiceKey) {
    throw new Error("Missing Supabase credentials in Settings");
  }

  // Delete all chunks from Supabase for this project
  const supabase = createClient(
    settings.supabaseUrl,
    settings.supabaseServiceKey
  );

  const { error: supabaseError } = await supabase
    .from("document_chunks")
    .delete()
    .eq("project_id", projectId);

  if (supabaseError) {
    console.error("Error deleting chunks from Supabase:", supabaseError);
    throw new Error("Failed to delete project embeddings");
  }

  // Delete all documents from MongoDB for this project
  await Doc.deleteMany({ projectId: new mongoose.Types.ObjectId(projectId) });

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

export async function createChat(projectId: string, title: string = "New Chat") {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  await connectToDatabase();

  const chat = await Chat.create({
    projectId: new mongoose.Types.ObjectId(projectId),
    userId: new mongoose.Types.ObjectId(String(session.id)),
    title,
    messages: [],
  });

  revalidatePath(`/projects/${projectId}`);
  return chat;
}

export async function deleteChat(projectId: string, chatId: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  await connectToDatabase();

  // Verify chat ownership
  const chat = await Chat.findOne({
    _id: new mongoose.Types.ObjectId(chatId),
    projectId: new mongoose.Types.ObjectId(projectId),
    userId: new mongoose.Types.ObjectId(String(session.id)),
  });

  if (!chat) throw new Error("Chat not found");

  await Chat.deleteOne({ _id: new mongoose.Types.ObjectId(chatId) });

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

export async function getOrCreateDefaultChat(projectId: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  await connectToDatabase();

  // Try to find an existing chat
  let chat = await Chat.findOne({
    projectId: new mongoose.Types.ObjectId(projectId),
    userId: new mongoose.Types.ObjectId(String(session.id)),
  }).sort({ createdAt: -1 });

  // If no chat exists, create one
  if (!chat) {
    chat = await Chat.create({
      projectId: new mongoose.Types.ObjectId(projectId),
      userId: new mongoose.Types.ObjectId(String(session.id)),
      title: "Chat #1",
      messages: [],
    });
  }

  return chat;
}

export async function renameChat(projectId: string, chatId: string, newTitle: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  if (!newTitle.trim()) throw new Error("Chat title cannot be empty");

  await connectToDatabase();

  // Verify chat ownership
  const chat = await Chat.findOne({
    _id: new mongoose.Types.ObjectId(chatId),
    projectId: new mongoose.Types.ObjectId(projectId),
    userId: new mongoose.Types.ObjectId(String(session.id)),
  });

  if (!chat) throw new Error("Chat not found");

  await Chat.updateOne(
    { _id: new mongoose.Types.ObjectId(chatId) },
    { $set: { title: newTitle.trim(), updatedAt: new Date() } }
  );

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}
