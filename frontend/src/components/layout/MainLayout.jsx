export default function MainLayout({ children }) {
  return (
    <div className="flex h-screen w-full flex-col bg-[#F8F9FB]">
      <main className="flex flex-1 overflow-hidden gap-6 p-6">{children}</main>
    </div>
  );
}
