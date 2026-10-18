"use server";
import { api } from "@/lib/api/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function accountAction(form: FormData) {
 const kind=String(form.get("kind"));
 const target=kind==="resend"?"/settings/verification":`/account/${kind}`;
 const paths:Record<string,string>={forgot:"/auth/forgot-password",reset:"/auth/reset-password",verify:"/auth/verify-email",resend:"/auth/resend-verification"};
 if (!paths[kind]) throw new Error("Unknown account action");
 let message="",error="";
 try {
  const result=await api<{message:string}>(paths[kind], kind==="forgot"?{email:String(form.get("email"))}:kind==="resend"?{}:{token:String(form.get("token")),...(kind==="reset"?{password:String(form.get("password"))}:{})},kind!=="resend");
  message=result.message;
 } catch(e) {error=e instanceof Error?e.message:"Could not complete this request";}
 revalidatePath("/settings/verification");
 redirect(`${target}?${error?`error=${encodeURIComponent(error)}&token=${encodeURIComponent(String(form.get("token")??""))}`:`message=${encodeURIComponent(message)}`}`);
}
