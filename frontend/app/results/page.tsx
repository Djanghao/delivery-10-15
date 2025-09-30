'use client';

import { App, Badge, Button, Card, Col, Descriptions, Flex, Image, Input, Modal, Popconfirm, Row, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { DeleteOutlined, DownloadOutlined, FilterOutlined } from '@ant-design/icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import RegionTree from '../../components/RegionTree';
import { apiFetch, API_BASE } from '../../lib/api';
import { useSharedRegions } from '../../lib/regionsStore';

interface ProjectItem {
  projectuuid: string;
  project_name: string;
  region_code: string;
  discovered_at: string;
  parsed_pdf?: boolean;
}

interface PaginatedProjects {
  items: ProjectItem[];
  total: number;
  page: number;
  size: number;
}

type Mode = 'history' | 'incremental';

export default function ResultsPage() {
  const { message } = App.useApp();
  const [selectedRegions, setSelectedRegions] = useSharedRegions();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [pagination, setPagination] = useState<TablePaginationConfig>({ current: 1, pageSize: 20, total: 0 });
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [regionNameMap, setRegionNameMap] = useState<Record<string, string>>({});
  const [rootRegionIds, setRootRegionIds] = useState<Set<string>>(new Set());
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<any | null>(null);

  // Captcha flow state for actions in detail modal
  const [captchaVisible, setCaptchaVisible] = useState(false);
  const [captchaImage, setCaptchaImage] = useState<string>('');
  const [captchaCode, setCaptchaCode] = useState('');
  const [downloadingOnlyLoading, setDownloadingOnlyLoading] = useState(false);
  const [reparseLoading, setReparseLoading] = useState(false);
  const [captchaSubmitting, setCaptchaSubmitting] = useState(false);
  const activeSessionRef = useRef<null | { parse_session_id: string }>(null);
  const activeContextRef = useRef<
    null | { project: ProjectItem; sendid: string; url: string; action: 'download' | 'reparse' }
  >(null);

  type RegionNode = { id: string; name: string; children?: RegionNode[] };
  const flattenRegions = (nodes: RegionNode[], acc: Record<string, string> = {}): Record<string, string> => {
    for (const n of nodes) {
      acc[n.id] = n.name;
      if (n.children && n.children.length) flattenRegions(n.children, acc);
    }
    return acc;
  };

  useEffect(() => {
    let mounted = true;
    async function loadRegions() {
      try {
        const regions = await apiFetch<RegionNode[]>(`/api/regions`);
        if (mounted) {
          setRegionNameMap(flattenRegions(regions));
          setRootRegionIds(new Set(regions.map((r) => r.id)));
        }
      } catch {
        // ignore mapping errors; fallback to codes
      }
    }
    loadRegions();
    const onRefreshed = () => loadRegions();
    window.addEventListener('regions-refreshed', onRefreshed);
    return () => {
      mounted = false;
      window.removeEventListener('regions-refreshed', onRefreshed);
    };
  }, []);

  const selectedRegionNames = useMemo(() => {
    const filtered = selectedRegions.filter((id) => !rootRegionIds.has(id));
    return filtered.map((id) => regionNameMap[id] ?? id);
  }, [selectedRegions, regionNameMap, rootRegionIds]);
  const loadProjects = useCallback(
    async (page = pagination.current ?? 1, pageSize = pagination.pageSize ?? 20) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        selectedRegions.forEach((region) => params.append('regions', region));
        params.set('page', String(page));
        params.set('size', String(pageSize));
        const payload = await apiFetch<PaginatedProjects>(`/api/projects?${params.toString()}`);
        setProjects(payload.items);
        setPagination({ current: payload.page, pageSize: payload.size, total: payload.total });
      } finally {
        setLoading(false);
      }
    },
    [pagination.current, pagination.pageSize, selectedRegions],
  );

  const handleFilter = async () => {
    if (selectedRegions.length === 0) {
      message.warning('请选择需要查看的地区');
      return;
    }
    await loadProjects(1, pagination.pageSize ?? 20);
  };

  const handleTableChange = async (pager: TablePaginationConfig) => {
    await loadProjects(pager.current ?? 1, pager.pageSize ?? 20);
  };

  const columns: ColumnsType<ProjectItem> = [
    {
      title: '项目名称',
      dataIndex: 'project_name',
      key: 'project_name',
      render: (text: string, record) => (
        <Space>
          <Typography.Text strong>{text}</Typography.Text>
          {record.parsed_pdf ? <Tag color="green">已解析PDF</Tag> : null}
        </Space>
      ),
    },
    {
      title: '项目编号',
      dataIndex: 'projectuuid',
      key: 'projectuuid',
      render: (value: string) => <Typography.Text code>{value}</Typography.Text>,
    },
    {
      title: '地区编码',
      dataIndex: 'region_code',
      key: 'region_code',
    },
    {
      title: '命中时间',
      dataIndex: 'discovered_at',
      key: 'discovered_at',
      render: (value: string) => new Date(value).toLocaleString('zh-CN', { hour12: false }),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button size="small" onClick={() => openDetail(record.projectuuid)}>查看详情</Button>
      ),
    },
  ];

  const handleDeleteFiltered = async () => {
    if (selectedRegions.length === 0) {
      message.warning('请选择需要删除的地区');
      return;
    }
    setDeleting(true);
    try {
      const params = new URLSearchParams();
      selectedRegions.forEach((region) => params.append('regions', region));
      const res = await apiFetch<{ deleted: number }>(`/api/projects/by-regions?${params.toString()}`, {
        method: 'DELETE',
      });
      message.success(`已删除 ${res.deleted} 条记录`);
      await loadProjects(1, pagination.pageSize ?? 20);
    } finally {
      setDeleting(false);
    }
  };

  const handleExport = () => {
    if (selectedRegions.length === 0) {
      message.warning('请选择至少一个地区再导出');
      return;
    }
    const params = new URLSearchParams();
    selectedRegions.forEach((region) => params.append('regions', region));
    window.open(`${API_BASE}/api/projects/export?${params.toString()}`, '_blank');
  };

  async function openDetail(projectuuid: string) {
    setDetailVisible(true);
    setDetailLoading(true);
    try {
      const data = await apiFetch<any>(`/api/projects/${projectuuid}`);
      setDetailData(data);
    } finally {
      setDetailLoading(false);
    }
  }

  // Helpers: fetch detail items and open captcha
  type ParseDetailItem = { sendid: string; item_name: string; url?: string | null };
  async function fetchFirstTargetItem(project: ProjectItem): Promise<ParseDetailItem | null> {
    const detail = await apiFetch<{ projectuuid: string; project_name: string; items: ParseDetailItem[] }>(
      `/api/parse/detail/${project.projectuuid}`,
    );
    const targets = detail.items.filter((it) =>
      [
        '企业投资（含外商投资）项目备案（基本建设）',
        '企业投资（含外商投资）项目备案（技术改造）',
        '企业投资（含外商投资）项目核准（基本建设）',
        '企业投资（含外商投资）项目核准（技术改造）',
      ].includes(it.item_name),
    );
    const first = targets.find((it) => !!it.url);
    return first ?? null;
  }

  async function openCaptcha(project: ProjectItem, item: ParseDetailItem, action: 'download' | 'reparse') {
    const res = await apiFetch<{ parse_session_id: string; captcha_image_base64: string }>(`/api/parse/captcha/start`, {
      method: 'POST',
      body: JSON.stringify({ projectuuid: project.projectuuid, sendid: item.sendid }),
    });
    activeSessionRef.current = { parse_session_id: res.parse_session_id };
    activeContextRef.current = { project, sendid: item.sendid, url: item.url || '', action };
    setCaptchaImage(res.captcha_image_base64);
    setCaptchaCode('');
    setCaptchaVisible(true);
  }

  async function handleDownloadOnly() {
    if (!detailData) return;
    const project: ProjectItem = {
      projectuuid: detailData.projectuuid,
      project_name: detailData.project_name,
      region_code: detailData.region_code,
      discovered_at: detailData.discovered_at,
      parsed_pdf: detailData.parsed_pdf,
    };
    setDownloadingOnlyLoading(true);
    try {
      const item = await fetchFirstTargetItem(project);
      if (!item || !item.url) {
        message.warning('未找到可下载的目标文件');
        setDownloadingOnlyLoading(false);
        return;
      }
      await openCaptcha(project, item, 'download');
    } catch (err) {
      message.error((err as Error).message || '准备下载失败');
      setDownloadingOnlyLoading(false);
    }
  }

  async function handleReparse() {
    if (!detailData) return;
    const project: ProjectItem = {
      projectuuid: detailData.projectuuid,
      project_name: detailData.project_name,
      region_code: detailData.region_code,
      discovered_at: detailData.discovered_at,
      parsed_pdf: detailData.parsed_pdf,
    };
    setReparseLoading(true);
    try {
      const item = await fetchFirstTargetItem(project);
      if (!item || !item.url) {
        message.warning('未找到可解析的目标文件');
        setReparseLoading(false);
        return;
      }
      await openCaptcha(project, item, 'reparse');
    } catch (err) {
      message.error((err as Error).message || '准备解析失败');
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
        method: 'POST',
        body: JSON.stringify({ parse_session_id: sess.parse_session_id, code: captchaCode }),
      });
      if (!verify.ok) {
        setCaptchaImage(verify.captcha_image_base64 || '');
        setCaptchaCode('');
        message.error('验证码错误，请重试');
        setCaptchaSubmitting(false);
        return;
      }
      // Verified → download to client or download+parse on server
      if (ctx.action === 'download') {
        const resp = await fetch(`${API_BASE}/api/parse/download-file`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            parse_session_id: sess.parse_session_id,
            url: ctx.url,
            projectuuid: ctx.project.projectuuid,
          }),
        });
        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(text || '下载失败');
        }
        const blob = await resp.blob();
        // Determine filename from url or header
        let filename = (ctx.url?.split('/').pop() || '').split('?')[0] || 'downloaded.pdf';
        try {
          const cd = resp.headers.get('Content-Disposition');
          const m = cd && /filename\s*=\s*([^;]+)/i.exec(cd);
          if (m && m[1]) {
            filename = decodeURIComponent(m[1].replace(/"/g, '').trim());
          }
        } catch {}
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } else {
        await apiFetch(`/api/parse/download`, {
          method: 'POST',
          body: JSON.stringify({
            parse_session_id: sess.parse_session_id,
            url: ctx.url,
            projectuuid: ctx.project.projectuuid,
            download_only: false,
          }),
        });
      }
      setCaptchaVisible(false);
      setCaptchaCode('');
      if (ctx.action === 'download') {
        message.success('文件已下载至本地');
        setDownloadingOnlyLoading(false);
      } else {
        message.success('已重新下载并解析PDF');
        setReparseLoading(false);
      }
      // Refresh detail data to reflect parsed status/path changes
      try {
        const data = await apiFetch<any>(`/api/projects/${ctx.project.projectuuid}`);
        setDetailData(data);
      } catch {}
    } catch (err) {
      message.error((err as Error).message || '处理失败');
      setCaptchaVisible(false);
      setCaptchaCode('');
      setDownloadingOnlyLoading(false);
      setReparseLoading(false);
    } finally {
      setCaptchaSubmitting(false);
    }
  }

  return (
    <Flex vertical gap={24}>
      <Card className="card" style={{ padding: 24 }}>
        <Row gutter={32}>
          <Col xs={24} md={12} lg={10}>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Typography.Text strong>地区选择</Typography.Text>
              <RegionTree value={selectedRegions} onChange={setSelectedRegions} />
            </Space>
          </Col>
          <Col xs={24} md={12} lg={14}>
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <Typography.Paragraph>
                选择需要查看的地区后，点击“按地区筛选”以加载对应的命中项目列表，可使用“导出筛选结果”下载 CSV 用于进一步分析。
              </Typography.Paragraph>
              <Space wrap size={[12, 12]} style={{ width: '100%' }}>
                <Button type="primary" icon={<FilterOutlined />} size="large" onClick={handleFilter}>
                  按地区筛选
                </Button>
                <Button icon={<DownloadOutlined />} size="large" onClick={handleExport}>
                  导出筛选结果
                </Button>
                <Popconfirm
                  title="删除筛选结果"
                  description={
                    <div style={{ maxWidth: 420, whiteSpace: 'normal', wordBreak: 'break-word' }}>
                      确定删除当前筛选的所有结果（{selectedRegionNames.join('、') || '未选择'}）？此操作不可撤销。
                    </div>
                  }
                  onConfirm={handleDeleteFiltered}
                  okButtonProps={{ danger: true }}
                  okText="删除"
                  cancelText="取消"
                  overlayStyle={{ width: 420 }}
                >
                  <Button danger icon={<DeleteOutlined />} size="large" disabled={selectedRegions.length === 0} loading={deleting}>
                    删除筛选结果
                  </Button>
                </Popconfirm>
              </Space>
              <Typography.Text type="secondary">
                当前所选地区：{selectedRegionNames.length === 0 ? '未选择' : selectedRegionNames.join('、')}
              </Typography.Text>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card className="card" style={{ padding: 24 }}>
        <Typography.Title level={4} style={{ marginBottom: 16 }}>
          命中项目列表
        </Typography.Title>
        <Table<ProjectItem>
          columns={columns}
          dataSource={projects}
          rowKey="projectuuid"
          loading={loading}
          pagination={pagination}
          onChange={handleTableChange}
        />
      </Card>

      {/* 任务执行摘要已移除 */}

      <Modal
        title="项目详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="download" loading={downloadingOnlyLoading} onClick={handleDownloadOnly}>
            下载PDF（仅下载）
          </Button>,
          <Button key="reparse" type="primary" loading={reparseLoading} onClick={handleReparse}>
            重新解析（下载+解析）
          </Button>,
          <Button key="close" onClick={() => setDetailVisible(false)}>
            关闭
          </Button>,
        ]}
        width={820}
      >
        {detailLoading ? (
          <Typography.Text>加载中...</Typography.Text>
        ) : detailData ? (
          <div style={{ maxHeight: 520, overflow: 'auto' }}>
            <Descriptions column={1} bordered size="small" labelStyle={{ width: 180 }}>
              <Descriptions.Item label="项目名称">{detailData.project_name}</Descriptions.Item>
              <Descriptions.Item label="项目编号">
                <Typography.Text code>{detailData.projectuuid}</Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="地区编码">{detailData.region_code}</Descriptions.Item>
              <Descriptions.Item label="命中时间">
                {new Date(detailData.discovered_at).toLocaleString('zh-CN', { hour12: false })}
              </Descriptions.Item>
              <Descriptions.Item label="PDF解析">
                {detailData.parsed_pdf ? <Tag color="green">已解析PDF</Tag> : <Tag>未解析</Tag>}
              </Descriptions.Item>
              {detailData.parsed_at ? (
                <Descriptions.Item label="解析时间">
                  {new Date(detailData.parsed_at).toLocaleString('zh-CN', { hour12: false })}
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
                      {String(v ?? '')}
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
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Typography.Text>请输入验证码以继续。</Typography.Text>
          {captchaImage ? (
            <Image src={captchaImage} alt="验证码" width={140} height={70} style={{ objectFit: 'contain' }} />
          ) : null}
          <Input placeholder="验证码" value={captchaCode} onChange={(e) => setCaptchaCode(e.target.value)} />
        </Space>
      </Modal>
    </Flex>
  );
}
