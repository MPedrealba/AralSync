import CoordinatorSidebar from "@/components/CoordinatorSidebar";
import { guardMustChangePassword } from "@/lib/auth";

export const metadata = {
  title: "AralSync — ARAL Coordinator",
};

export default async function CoordinatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await guardMustChangePassword();
  return (
    <div className="flex min-h-screen">
      <CoordinatorSidebar />
      <div className="ml-64 flex flex-1 flex-col">{children}</div>
    </div>
  );
}