"use server";

import { redirect } from "next/navigation";
import { checkCredentials, startSession } from "@/lib/auth";

export type LoginState = { error: string | null };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!checkCredentials(username, password)) {
    return { error: "Invalid username or password." };
  }

  await startSession();
  redirect("/admin");
}
