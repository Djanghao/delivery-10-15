"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { API_BASE, getJSON } from "@/lib/api";

type Project = { projectuuid: string; project_name: string; region_code: string };
type ListResp = { items: Project[]; total: number; page: number; size: number };

export default function Page() {
  const [region, setRegion] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(20);
  const [data, setData] = useState<ListResp | null>(null);

  async function load() {
    const params = new URLSearchParams();
    if (region) params.set("region", region);
    params.set("page", String(page));
    params.set("size", String(size));
    const resp = await getJSON<ListResp>(`/api/projects?${params.toString()}`);
    setData(resp);
  }

  useEffect(() => { load(); }, [page, size]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="font-semibold">命中项目</div>
          <div className="flex items-center gap-2 text-sm">
            <Input placeholder="地区代码过滤，如 330354" value={region} onChange={(e) => setRegion(e.target.value)} />
            <Button onClick={() => { setPage(1); load(); }}>查询</Button>
            <a
              className="inline-flex items-center rounded-full border px-4 py-2 text-sm"
              href={`${API_BASE}/api/projects/export${region ? `?region=${region}` : ""}`}
              target="_blank"
            >导出 CSV</a>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="py-2">项目ID</th>
                <th className="py-2">项目名称</th>
                <th className="py-2">地区代码</th>
              </tr>
            </thead>
            <tbody>
              {data?.items?.map((p) => (
                <tr key={p.projectuuid} className="border-t">
                  <td className="py-2 font-mono text-xs">{p.projectuuid}</td>
                  <td className="py-2">{p.project_name}</td>
                  <td className="py-2">{p.region_code}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex items-center justify-between text-sm">
          <div>共 {data?.total ?? 0} 条</div>
          <div className="flex items-center gap-2">
            <Button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>上一页</Button>
            <div>第 {page} 页</div>
            <Button onClick={() => setPage((p) => p + 1)}>下一页</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

