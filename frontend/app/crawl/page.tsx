"use client";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { API_BASE, getJSON, postJSON } from "@/lib/api";

type Region = { id: string; pId?: string | null; name: string };

export default function Page() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [mode, setMode] = useState<"history" | "incremental">("history");
  const [filter, setFilter] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [logs, setLogs] = useState("");

  useEffect(() => {
    getJSON<Region[]>("/api/regions").then(setRegions).catch(console.error);
  }, []);

  const tree = useMemo(() => {
    const map: Record<string, Region & { children: Region[] }> = {};
    regions.forEach((r) => (map[r.id] = { ...r, children: [] }));
    regions.forEach((r) => {
      if (r.pId && map[r.pId]) map[r.pId].children.push(map[r.id]);
    });
    return Object.values(map).filter((r) => !r.pId);
  }, [regions]);

  function collectDescendants(id: string): string[] {
    const byId: Record<string, Region & { children?: Region[] }> = {};
    regions.forEach((r) => (byId[r.id] = r as any));
    const children = regions.filter((r) => r.pId === id).map((r) => r.id);
    const stack = [...children];
    const out: string[] = [...children];
    while (stack.length) {
      const cur = stack.pop()!;
      const subs = regions.filter((r) => r.pId === cur).map((r) => r.id);
      out.push(...subs);
      stack.push(...subs);
    }
    return out;
  }

  function toggle(id: string, value: boolean) {
    const withChildren = [id, ...collectDescendants(id)];
    setChecked((prev) => {
      const next = { ...prev };
      withChildren.forEach((rid) => (next[rid] = value));
      return next;
    });
  }

  function selectedIds(): string[] {
    return Object.keys(checked).filter((k) => checked[k]);
  }

  async function start() {
    const regions = selectedIds();
    if (regions.length === 0) return alert("请至少选择一个地区");
    const res = await postJSON<{ job_id: string }>("/api/crawl/start", {
      mode,
      regions,
    });
    setJobId(res.job_id);
  }

  useEffect(() => {
    if (!jobId) return;
    const s = setInterval(async () => {
      const res = await fetch(`${API_BASE}/api/crawl/logs?job_id=${jobId}`, { cache: "no-store" });
      setLogs(await res.text());
    }, 1000);
    return () => clearInterval(s);
  }, [jobId]);

  function Node({ node, level = 0 }: { node: any; level?: number }) {
    if (filter && !node.name.includes(filter)) return null;
    return (
      <div className="space-y-1">
        <label className="flex items-center gap-2" style={{ paddingLeft: level * 12 }}>
          <Checkbox checked={!!checked[node.id]} onChange={(e) => toggle(node.id, (e.target as HTMLInputElement).checked)} />
          <span>{node.name}</span>
        </label>
        {node.children?.map((c: any) => (
          <Node key={c.id} node={c} level={level + 1} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="font-semibold">选择地区</div>
            <div className="flex items-center gap-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" name="mode" checked={mode === "history"} onChange={() => setMode("history")} /> 历史
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="mode" checked={mode === "incremental"} onChange={() => setMode("incremental")} /> 增量
              </label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-3"><Input placeholder="搜索地区..." value={filter} onChange={(e) => setFilter(e.target.value)} /></div>
          <ScrollArea className="h-[480px] pr-2">
            <div className="space-y-2">
              {tree.map((n) => (
                <Node key={n.id} node={n} />
              ))}
            </div>
          </ScrollArea>
          <div className="mt-4 flex items-center justify-between text-sm">
            <div>已选 {selectedIds().length} 个地区</div>
            <Button onClick={start}>开始爬取</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="font-semibold">实时日志</div>
        </CardHeader>
        <CardContent>
          {!jobId ? (
            <div className="text-gray-500">启动任务后显示日志</div>
          ) : (
            <ScrollArea className="h-[560px] text-[13px] whitespace-pre-wrap">
              <pre>{logs || "等待中..."}</pre>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

