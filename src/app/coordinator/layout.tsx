import CoordinatorSidebar from "@/components/CoordinatorSidebar";

export const metadata = {
  title: "AralSync — ARAL Coordinator",
};

export default function CoordinatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <CoordinatorSidebar />
      <div className="ml-64 flex flex-1 flex-col">{children}</div>
    </div>
  );
}