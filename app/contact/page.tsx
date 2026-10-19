import { redirect } from "next/navigation";

export default function ContactRedirect() {
  redirect("/?chat=1");
}
