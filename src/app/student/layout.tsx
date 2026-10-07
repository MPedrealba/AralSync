import StudentSidebar from "@/components/StudentSidebar";
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
  return (
    <div className="student-portal">
      <div className="app-container">
        <StudentSidebar />
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}
