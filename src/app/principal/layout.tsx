import PrincipalSidebar from "@/components/PrincipalSidebar";

export const metadata = {
  title: "AralSync — Principal Dashboard",
};

export default function PrincipalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <PrincipalSidebar />
      <div className="ml-64 flex flex-1 flex-col">{children}</div>
    </div>
  );
}
