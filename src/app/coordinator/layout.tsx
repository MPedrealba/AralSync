import { guardMustChangePassword } from "@/lib/auth";
import CoordinatorShell from "@/components/CoordinatorShell";

export const metadata = {
  title: "AralSync — ARAL Coordinator",
};

export default async function CoordinatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await guardMustChangePassword();
  return <CoordinatorShell>{children}</CoordinatorShell>;
}