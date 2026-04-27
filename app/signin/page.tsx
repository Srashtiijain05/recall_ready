import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import SignInPage from "./(components)/page";

export default async function SignIn() {
  const session = await getSession();
  if (session) {
    redirect("/projects");
  }

  return <SignInPage />;
}
