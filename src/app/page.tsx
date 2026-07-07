import { redirect } from "next/navigation";

export default function Home() {
  redirect(encodeURI("/c001/浏览页"));
}
