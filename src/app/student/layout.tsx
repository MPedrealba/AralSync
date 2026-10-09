import StudentShell from "@/components/StudentShell";
import "./student-portal.css";
import { guardMustChangePassword } from "@/lib/auth";

export const metadata = {
  title: "AralSync — Student Portal",
};

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await guardMustChangePassword();
  return <StudentShell>{children}</StudentShell>;
}
