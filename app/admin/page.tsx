import { isAdmin, authConfigured } from "@/lib/auth";
import AdminApp from "@/components/admin/AdminApp";
import "./admin.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reel Admin" };

export default async function Page() {
  return <AdminApp authed={await isAdmin()} configured={authConfigured()} />;
}
