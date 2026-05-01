export default function MainLayout({ children, header, theme = "dark" }) {
  return (
    <div className={`theme-${theme} flex h-screen w-full flex-col bg-[#06080A] text-[#F7F7F8]`}>
      {header}
      <main className="flex min-h-0 flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
