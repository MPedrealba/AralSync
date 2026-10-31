import { guardMustChangePassword } from "@/lib/auth";
import PrincipalShell from "@/components/PrincipalShell";

export const metadata = {
  title: "AralSync — Principal Dashboard",
};

export default async function PrincipalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await guardMustChangePassword();
  return <PrincipalShell>{children}</PrincipalShell>;
}
