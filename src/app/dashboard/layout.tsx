import Sidebar from "@/components/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="ml-64 flex flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
