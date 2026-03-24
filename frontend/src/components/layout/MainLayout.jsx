export default function MainLayout({ children }) {
  return (
    <div className="flex h-screen w-full flex-col bg-[#F8F9FB]">
      {/* Sidebar navigation is omitted as per Body.png design preference, we just have the 2 main panes */}
      <main className="flex flex-1 overflow-hidden p-6 gap-6">
        {children}
      </main>
      
      {/* Bottom Status Bar */}
      <footer className="flex h-12 items-center justify-between border-t border-gray-200 bg-white px-6 text-sm text-slate-500">
        <div className="flex gap-6">
          <span>同期状態: <span className="text-blue-600">接続済み</span></span>
          <span>ワークスペース: <span className="text-slate-700 font-medium">Standard_Prod_v2</span></span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-blue-600"></div>
            <span>8.5h 割り当て済み</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-slate-200"></div>
            <span>31.5h 空き</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
