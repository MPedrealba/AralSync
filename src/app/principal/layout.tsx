import PrincipalSidebar from "@/components/PrincipalSidebar";
import { guardMustChangePassword } from "@/lib/auth";

export const metadata = {
  title: "AralSync — Principal Dashboard",
};

export default async function PrincipalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await guardMustChangePassword();
  return (
    <div className="flex min-h-screen">
      <PrincipalSidebar />
      <div className="ml-64 flex flex-1 flex-col">{children}</div>
    </div>
  );
}
