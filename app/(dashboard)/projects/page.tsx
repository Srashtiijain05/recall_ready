import mongoose from "mongoose";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb/connect";
import { Project } from "@/models/Project";
import { Plus, Folder, ArrowRight } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createProject, deleteProject } from "./actions";
import CreateProjectForm from "@/components/CreateProjectForm";
import DeleteProjectButton from "@/components/DeleteProjectButton";

export default async function ProjectsPage() {
  const session = await getSession();
  if (!session) redirect("/");

  await connectToDatabase();

  // Fetch projects
  const projects = await Project.find({
    userId: new mongoose.Types.ObjectId(String(session.id)),
  })
    .sort({ createdAt: -1 })
    .lean();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
        <p className="text-[var(--muted-foreground)] mt-2">
          Manage your RAG workspaces. Each project has isolated documents and
          embeddings.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Create Project Card */}
        <CreateProjectForm />

        {/* Existing Projects */}
        {projects.map((project: any) => (
          <div
            key={project._id.toString()}
            className="group p-6 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-sm flex flex-col justify-between min-h-[200px] hover:shadow-md transition-all"
          >
            <div className="space-y-2">
              <div className="flex justify-between items-start">
                <div className="h-10 w-10 rounded-xl bg-[var(--background)] border border-[var(--border)] flex items-center justify-center">
                  <Folder size={20} className="text-[var(--foreground)]" />
                </div>
                <DeleteProjectButton projectId={project._id.toString()} />
              </div>
              <h3 className="font-semibold text-xl tracking-tight mt-4">
                {project.name}
              </h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                Created {new Date(project.createdAt).toLocaleDateString()}
              </p>
            </div>

            <Link
              href={`/projects/${project._id}`}
              className="flex items-center justify-between mt-6 pt-4 border-t border-[var(--border)] text-sm font-medium hover:text-[var(--accent)] transition-colors"
            >
              Open Project
              <ArrowRight
                size={16}
                className="transform group-hover:translate-x-1 transition-transform"
              />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
