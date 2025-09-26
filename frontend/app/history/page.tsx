"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getJSON } from "@/lib/api";

type Progress = { region_code: string; last_pivot_sendid?: string | null; updated_at?: string | null };

export default function Page() {
  const [regions, setRegions] = useState<{ id: string; pId?: string | null; name: string }[]>([]);
  const [rows, setRows] = useState<(Progress & { name?: string })[]>([]);

  useEffect(() => {
    async function load() {
      const list = await getJSON<any[]>("/api/regions");
      setRegions(list);
      // naive: show top-level cities only
      const targets = list.filter((r) => r.pId === "330000" || r.pId === null || r.pId === undefined);
      const merged: (Progress & { name?: string })[] = [];
      for (const r of targets) {
        try {
          const p = await getJSON<Progress>(`/api/progress/${r.id}`);
          merged.push({ ...p, name: r.name });
        } catch {}
      }
      setRows(merged);
    }
    load();
  }, []);

  return (
    <Card>
      <CardHeader>
        <div className="font-semibold">历史进度</div>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="py-2">地区</th>
                <th className="py-2">地区代码</th>
                <th className="py-2">最近 pivot</th>
                <th className="py-2">更新时间</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.region_code} className="border-t">
                  <td className="py-2">{r.name || "-"}</td>
                  <td className="py-2">{r.region_code}</td>
                  <td className="py-2 font-mono text-xs">{r.last_pivot_sendid || "-"}</td>
                  <td className="py-2">{r.updated_at || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

