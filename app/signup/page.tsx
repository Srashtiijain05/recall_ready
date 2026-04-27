import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import SignUpPage from "./(components)/page";

export default async function SignUp() {
  const session = await getSession();
  if (session) {
    redirect("/projects");
  }
  return <SignUpPage />;
}
