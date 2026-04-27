"use server";

import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import connectToDatabase from "@/lib/mongodb/connect";
import { Project } from "@/models/Project";
import { getSession } from "@/lib/auth";
import { creditCredits, debitCredits } from "@/lib/credits";

export async function createProject(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const name = formData.get("name") as string;
  if (!name || name.trim() === "") throw new Error("Project name is required");

  await connectToDatabase();

  const PROJECT_CREATE_COST = 50;
  try {
    await debitCredits(String(session.id), PROJECT_CREATE_COST, "CREATE_PROJECT", undefined, {
      project_name: name.trim(),
    });
  } catch (error) {
    throw new Error("Insufficient credits to create project");
  }

  let project;
  try {
    project = await Project.create({
      userId: new mongoose.Types.ObjectId(String(session.id)),
      name: name.trim(),
    });
  } catch (error) {
    await creditCredits(String(session.id), PROJECT_CREATE_COST, "REFUND_CREATE_PROJECT", undefined, {
      project_name: name.trim(),
    }).catch(() => undefined);
    throw error;
  }

  revalidatePath("/projects");
}

export async function deleteProject(projectId: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  await connectToDatabase();

  await Project.findOneAndDelete({
    _id: new mongoose.Types.ObjectId(projectId),
    userId: new mongoose.Types.ObjectId(String(session.id)),
  });

  revalidatePath("/projects");
}
