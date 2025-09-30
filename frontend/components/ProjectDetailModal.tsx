"use client";

import { App, Badge, Button, Descriptions, Image, Input, Modal, Space, Tag, Typography } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch, API_BASE } from "../lib/api";

interface ProjectItem {
  projectuuid: string;
  project_name: string;
  region_code: string;
  discovered_at: string;
  parsed_pdf?: boolean;
}

type ParseDetailItem = { sendid: string; item_name: string; url?: string | null };

interface ProjectDetailModalProps {
  open: boolean;
  onClose: () => void;
  projectuuid: string | null;
  allowActions?: boolean;
}

export default function ProjectDetailModal({ open, onClose, projectuuid, allowActions = true }: ProjectDetailModalProps) {
  const { message } = App.useApp();
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<any | null>(null);

  // Actions loading state
  const [downloadingOnlyLoading, setDownloadingOnlyLoading] = useState(false);
  const [reparseLoading, setReparseLoading] = useState(false);

  // Captcha modal state
  const [captchaVisible, setCaptchaVisible] = useState(false);
  const [captchaImage, setCaptchaImage] = useState<string>("");
  const [captchaCode, setCaptchaCode] = useState("");
  const [captchaSubmitting, setCaptchaSubmitting] = useState(false);
  const activeSessionRef = useRef<null | { parse_session_id: string }>(null);
  const activeContextRef = useRef<
    null | { project: ProjectItem; sendid: string; url: string; action: "download" | "reparse" }
  >(null);

  const projectForActions: ProjectItem | null = useMemo(() => {
    if (!detailData) return null;
    return {
      projectuuid: detailData.projectuuid,
      project_name: detailData.project_name,
      region_code: detailData.region_code,
      discovered_at: detailData.discovered_at,
      parsed_pdf: detailData.parsed_pdf,
    } as ProjectItem;
  }, [detailData]);

  useEffect(() => {
    let mounted = true;
    async function loadDetail() {
      if (!open || !projectuuid) return;
      setDetailLoading(true);
      try {
        const data = await apiFetch<any>(`/api/projects/${projectuuid}`);
        if (mounted) setDetailData(data);
      } finally {
        if (mounted) setDetailLoading(false);
      }
    }
    loadDetail();
    return () => {
      mounted = false;
    };
  }, [open, projectuuid]);

  async function fetchFirstTargetItem(project: ProjectItem): Promise<ParseDetailItem | null> {
    const detail = await apiFetch<{ projectuuid: string; project_name: string; items: ParseDetailItem[] }>(
      `/api/parse/detail/${project.projectuuid}`,
    );
    const targets = detail.items.filter((it) =>
      [
        "企业投资（含外商投资）项目备案（基本建设）",
        "企业投资（含外商投资）项目备案（技术改造）",
        "企业投资（含外商投资）项目核准（基本建设）",
        "企业投资（含外商投资）项目核准（技术改造）",
      ].includes(it.item_name),
    );
    const first = targets.find((it) => !!it.url);
    return first ?? null;
  }

  async function openCaptcha(project: ProjectItem, item: ParseDetailItem, action: "download" | "reparse") {
    const res = await apiFetch<{ parse_session_id: string; captcha_image_base64: string }>(`/api/parse/captcha/start`, {
      method: "POST",
      body: JSON.stringify({ projectuuid: project.projectuuid, sendid: item.sendid }),
    });
    activeSessionRef.current = { parse_session_id: res.parse_session_id };
    activeContextRef.current = { project, sendid: item.sendid, url: item.url || "", action };
    setCaptchaImage(res.captcha_image_base64);
    setCaptchaCode("");
    setCaptchaVisible(true);
  }

  async function handleDownloadOnly() {
    if (!projectForActions) return;
    setDownloadingOnlyLoading(true);
    try {
      const item = await fetchFirstTargetItem(projectForActions);
      if (!item || !item.url) {
        message.warning("未找到可下载的目标文件");
        setDownloadingOnlyLoading(false);
        return;
      }
      await openCaptcha(projectForActions, item, "download");
    } catch (err) {
      message.error((err as Error).message || "准备下载失败");
      setDownloadingOnlyLoading(false);
    }
  }

  async function handleReparse() {
    if (!projectForActions) return;
    setReparseLoading(true);
    try {
      const item = await fetchFirstTargetItem(projectForActions);
      if (!item || !item.url) {
        message.warning("未找到可解析的目标文件");
        setReparseLoading(false);
        return;
      }
      await openCaptcha(projectForActions, item, "reparse");
    } catch (err) {
      message.error((err as Error).message || "准备解析失败");
      setReparseLoading(false);
    }
  }

  async function submitCaptcha() {
    const sess = activeSessionRef.current;
    const ctx = activeContextRef.current;
    if (!sess || !ctx) return;
    try {
      setCaptchaSubmitting(true);
      const verify = await apiFetch<{ ok: boolean; captcha_image_base64?: string }>(`/api/parse/captcha/verify`, {
        method: "POST",
        body: JSON.stringify({ parse_session_id: sess.parse_session_id, code: captchaCode }),
      });
      if (!verify.ok) {
        setCaptchaImage(verify.captcha_image_base64 || "");
        setCaptchaCode("");
        message.error("验证码错误，请重试");
        setCaptchaSubmitting(false);
        return;
      }
      if (ctx.action === "download") {
        const resp = await fetch(`${API_BASE}/api/parse/download-file`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parse_session_id: sess.parse_session_id,
            url: ctx.url,
            projectuuid: ctx.project.projectuuid,
          }),
        });
        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(text || "下载失败");
        }
        const blob = await resp.blob();
        let filename = (ctx.url?.split("/").pop() || "").split("?")[0] || "downloaded.pdf";
        try {
          const cd = resp.headers.get("Content-Disposition");
          const m = cd && /filename\s*=\s*([^;]+)/i.exec(cd);
          if (m && m[1]) {
            filename = decodeURIComponent(m[1].replace(/\"/g, "").trim());
          }
        } catch {}
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } else {
        await apiFetch(`/api/parse/download`, {
          method: "POST",
          body: JSON.stringify({
            parse_session_id: sess.parse_session_id,
            url: ctx.url,
            projectuuid: ctx.project.projectuuid,
            download_only: false,
          }),
        });
      }
      setCaptchaVisible(false);
      setCaptchaCode("");
      if (ctx.action === "download") {
        message.success("文件已下载至本地");
        setDownloadingOnlyLoading(false);
      } else {
        message.success("已重新下载并解析PDF");
        setReparseLoading(false);
      }
      // Refresh detail data to reflect parsed status/path changes
      try {
        if (projectuuid) {
          const data = await apiFetch<any>(`/api/projects/${projectuuid}`);
          setDetailData(data);
        }
      } catch {}
    } catch (err) {
      message.error((err as Error).message || "处理失败");
    } finally {
      setCaptchaSubmitting(false);
    }
  }

  return (
    <>
      <Modal
        title="项目详情"
        open={open}
        onCancel={onClose}
        footer={
          allowActions
            ? [
                <Button key="download" loading={downloadingOnlyLoading} onClick={handleDownloadOnly}>
                  下载PDF（仅下载）
                </Button>,
                <Button key="reparse" type="primary" loading={reparseLoading} onClick={handleReparse}>
                  重新解析（下载+解析）
                </Button>,
                <Button key="close" onClick={onClose}>
                  关闭
                </Button>,
              ]
            : [
                <Button key="close" onClick={onClose}>
                  关闭
                </Button>,
              ]
        }
        width={820}
      >
        {detailLoading ? (
          <Typography.Text>加载中...</Typography.Text>
        ) : detailData ? (
          <div style={{ maxHeight: 520, overflow: "auto" }}>
            <Descriptions column={1} bordered size="small" labelStyle={{ width: 180 }}>
              <Descriptions.Item label="项目名称">{detailData.project_name}</Descriptions.Item>
              <Descriptions.Item label="项目编号">
                <Typography.Text code>{detailData.projectuuid}</Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="地区编码">{detailData.region_code}</Descriptions.Item>
              <Descriptions.Item label="命中时间">
                {new Date(detailData.discovered_at).toLocaleString("zh-CN", { hour12: false })}
              </Descriptions.Item>
              <Descriptions.Item label="PDF解析">
                {detailData.parsed_pdf ? <Tag color="green">已解析PDF</Tag> : <Tag>未解析</Tag>}
              </Descriptions.Item>
              {detailData.parsed_at ? (
                <Descriptions.Item label="解析时间">
                  {new Date(detailData.parsed_at).toLocaleString("zh-CN", { hour12: false })}
                </Descriptions.Item>
              ) : null}
              {detailData.pdf_file_path ? (
                <Descriptions.Item label="文件路径">{detailData.pdf_file_path}</Descriptions.Item>
              ) : null}
            </Descriptions>
            {detailData.pdf_extract ? (
              <div style={{ marginTop: 16 }}>
                <Typography.Title level={5}>提取信息</Typography.Title>
                <Descriptions column={1} size="small" bordered>
                  {Object.entries(detailData.pdf_extract).map(([k, v]) => (
                    <Descriptions.Item key={k} label={k}>
                      {String(v ?? "")}
                    </Descriptions.Item>
                  ))}
                </Descriptions>
              </div>
            ) : null}
          </div>
        ) : (
          <Typography.Text type="secondary">暂无数据</Typography.Text>
        )}
      </Modal>

      {/* Captcha Modal */}
      <Modal
        title={
          <Space>
            <Badge color="#1677ff" />
            <span>输入验证码</span>
          </Space>
        }
        open={captchaVisible}
        onCancel={() => {
          setCaptchaVisible(false);
          setDownloadingOnlyLoading(false);
          setReparseLoading(false);
        }}
        onOk={submitCaptcha}
        confirmLoading={captchaSubmitting}
        okText="提交"
        cancelText="取消"
      >
        <Space direction="vertical" style={{ width: "100%" }} size={12}>
          <Typography.Text>请输入验证码以继续。</Typography.Text>
          {captchaImage ? (
            <Image src={captchaImage} alt="验证码" width={140} height={70} style={{ objectFit: "contain" }} />
          ) : null}
          <Input placeholder="验证码" value={captchaCode} onChange={(e) => setCaptchaCode(e.target.value)} />
        </Space>
      </Modal>
    </>
  );
}

