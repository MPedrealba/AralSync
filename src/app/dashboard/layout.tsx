import { guardMustChangePassword } from "@/lib/auth";
import DashboardShell from "@/components/DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await guardMustChangePassword();
  return <DashboardShell>{children}</DashboardShell>;
}
