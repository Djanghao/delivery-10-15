import "./globals.css";
import Link from "next/link";
import { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="min-h-screen flex">
          <aside className="w-[260px] border-r bg-white/70 backdrop-blur">
            <div className="p-4 text-xl font-bold">政务统计爬取</div>
            <nav className="flex flex-col gap-1 p-2 text-[15px]">
              <Link className="rounded-lg px-3 py-2 hover:bg-muted" href="/crawl">爬取任务</Link>
              <Link className="rounded-lg px-3 py-2 hover:bg-muted" href="/results">结果数据</Link>
              <Link className="rounded-lg px-3 py-2 hover:bg-muted" href="/history">历史进度</Link>
            </nav>
            <div className="mt-auto p-4 text-xs text-gray-500">Twitter 风格 · 简洁</div>
          </aside>
          <main className="flex-1">
            <header className="sticky top-0 z-10 border-b bg-white/70 backdrop-blur">
              <div className="container mx-auto px-6 py-4 text-lg font-semibold">浙江投资项目审批 · 管理台</div>
            </header>
            <div className="container mx-auto p-6">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}

