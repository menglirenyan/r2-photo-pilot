import { redirect } from "next/navigation";

export default function Home() {
  redirect(encodeURI("/demo-factory/浏览页"));
}
