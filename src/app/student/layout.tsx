import StudentSidebar from "@/components/StudentSidebar";
import "./student-portal.css";

export const metadata = {
  title: "AralSync — Student Portal",
};

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="student-portal">
      <div className="app-container">
        <StudentSidebar />
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}
