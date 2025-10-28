'use client';

import { App, Badge, Button, Card, Col, Flex, Image, Input, Modal, Row, Space, Spin, Table, Tabs, Tag, Typography } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { FilterOutlined, PlayCircleOutlined, StopOutlined, LoadingOutlined } from '@ant-design/icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import RegionTree from '../../components/RegionTree';
import ProjectDetailModal from '../../components/ProjectDetailModal';
import { apiFetch } from '../../lib/api';
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

interface ProjectCounts {
  all: number;
  parsed: number;
  unparsed: number;
}

interface ParseDetailItem {
  sendid: string;
  item_name: string;
  url?: string | null;
}

type ParseSession = {
  parse_session_id: string;
  captcha_image_base64: string;
};

export default function ExtractPage() {
  const { message } = App.useApp();
  const [selectedRegions, setSelectedRegions] = useSharedRegions();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [pagination, setPagination] = useState<TablePaginationConfig>({ current: 1, pageSize: 20, total: 0 });
  const [loading, setLoading] = useState(false);
  const [regionNameMap, setRegionNameMap] = useState<Record<string, string>>({});
  const [rootRegionIds, setRootRegionIds] = useState<Set<string>>(new Set());
  const [parsedFilter, setParsedFilter] = useState<'all' | 'parsed' | 'unparsed'>('all');
  const [counts, setCounts] = useState<ProjectCounts>({ all: 0, parsed: 0, unparsed: 0 });

  const [captchaVisible, setCaptchaVisible] = useState(false);
  const [captchaImage, setCaptchaImage] = useState<string>('');
  const [captchaCode, setCaptchaCode] = useState('');
  const [captchaSubmitting, setCaptchaSubmitting] = useState(false);
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [currentProjectName, setCurrentProjectName] = useState<string>('');
  const [currentItemName, setCurrentItemName] = useState<string>('');
  const activeSessionRef = useRef<ParseSession | null>(null);
  const activeContextRef = useRef<{ project: ProjectItem; item: ParseDetailItem } | null>(null);
  const stopRequestedRef = useRef(false);
  const captchaInputRef = useRef<any>(null);

  // Project detail modal state
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedProjectUUID, setSelectedProjectUUID] = useState<string | null>(null);

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

  const loadCounts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      selectedRegions.forEach((region) => params.append('regions', region));
      const payload = await apiFetch<ProjectCounts>(`/api/projects/counts?${params.toString()}`);
      setCounts(payload);
    } catch {
      setCounts({ all: 0, parsed: 0, unparsed: 0 });
    }
  }, [selectedRegions]);

  const loadProjects = useCallback(
    async (
      page = pagination.current ?? 1,
      pageSize = pagination.pageSize ?? 20,
      parsedKey: 'all' | 'parsed' | 'unparsed' = parsedFilter,
    ) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        selectedRegions.forEach((region) => params.append('regions', region));
        params.set('page', String(page));
        params.set('size', String(pageSize));
        if (parsedKey === 'parsed') {
          params.set('parsed', 'true');
        } else if (parsedKey === 'unparsed') {
          params.set('parsed', 'false');
        }
        const payload = await apiFetch<PaginatedProjects>(`/api/projects?${params.toString()}`);
        setProjects(payload.items);
        setPagination({ current: payload.page, pageSize: payload.size, total: payload.total });
      } finally {
        setLoading(false);
      }
    },
    [selectedRegions, parsedFilter],
  );

  const handleFilter = async () => {
    if (selectedRegions.length === 0) {
      message.warning('请选择需要查看的地区');
      return;
    }
    await Promise.all([loadProjects(1, pagination.pageSize ?? 20), loadCounts()]);
  };

  const handleTableChange = async (pager: TablePaginationConfig) => {
    await loadProjects(pager.current ?? 1, pager.pageSize ?? 20);
  };

  const handleTabChange = async (key: string) => {
    const next = key as 'all' | 'parsed' | 'unparsed';
    setParsedFilter(next);
    await loadProjects(1, pagination.pageSize ?? 20, next);
  };

  const columns: ColumnsType<ProjectItem> = [
    {
      title: '项目名称',
      dataIndex: 'project_name',
      key: 'project_name',
      render: (text: string) => <Typography.Text strong>{text}</Typography.Text>,
    },
    {
      title: '项目编号',
      dataIndex: 'projectuuid',
      key: 'projectuuid',
      render: (value: string) => <Typography.Text code>{value}</Typography.Text>,
    },
    {
      title: '状态',
      dataIndex: 'parsed_pdf',
      key: 'parsed_pdf',
      render: (val?: boolean) => (val ? <Tag color="green">已解析PDF</Tag> : <Tag>未解析</Tag>),
    },
    {
      title: '解析',
      key: 'parse',
      render: (_, record) => (
        <Button size="small" onClick={() => parseSingleProject(record)} icon={<PlayCircleOutlined />}>解析该项目</Button>
      ),
    },
    {
      title: '查看',
      key: 'detail',
      render: (_, record) => (
        <Button size="small" onClick={() => { setSelectedProjectUUID(record.projectuuid); setDetailVisible(true); }}>查看详情</Button>
      ),
    },
  ];

  async function openCaptcha(project: ProjectItem, item: ParseDetailItem) {
    setCaptchaVisible(true);
    setCaptchaLoading(true);
    setCurrentProjectName(project.project_name);
    setCurrentItemName(item.item_name);
    setCaptchaCode('');
    setCaptchaImage('');

    try {
      const res = await apiFetch<ParseSession>(`/api/parse/captcha/start`, {
        method: 'POST',
        body: JSON.stringify({ projectuuid: project.projectuuid, sendid: item.sendid }),
      });
      activeSessionRef.current = res;
      activeContextRef.current = { project, item };
      setCaptchaImage(res.captcha_image_base64);
    } finally {
      setCaptchaLoading(false);
      setTimeout(() => {
        captchaInputRef.current?.focus();
      }, 100);
    }
  }

  async function parseSingleProject(project: ProjectItem) {
    try {
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
      for (const it of targets) {
        if (!it.url) continue;
        if (stopRequestedRef.current) break;
        await openCaptcha(project, it);
        await new Promise<void>((resolve, reject) => {
          const handler = (e: CustomEvent<{ success: boolean }>) => {
            window.removeEventListener('parse-step-finished', handler as EventListener);
            if (e.detail.success) resolve();
            else reject(new Error('解析中断'));
          };
          window.addEventListener('parse-step-finished', handler as EventListener);
        });
      }
      await Promise.all([loadProjects(pagination.current ?? 1, pagination.pageSize ?? 20), loadCounts()]);
    } catch (err) {
      message.error((err as Error).message || '解析失败');
    }
  }

  async function handleStartBatch() {
    if (selectedRegions.length === 0) {
      message.warning('请先选择至少一个地区');
      return;
    }
    stopRequestedRef.current = false;
    try {
      for (const p of projects) {
        if (stopRequestedRef.current) break;
        await parseSingleProject(p);
      }
    } finally {
      setCaptchaVisible(false);
    }
  }

  function handleStopBatch() {
    stopRequestedRef.current = true;
    setCaptchaVisible(false);
    setCaptchaLoading(false);
    setCaptchaSubmitting(false);
    const ev = new CustomEvent('parse-step-finished', { detail: { success: false } });
    window.dispatchEvent(ev);
  }

  async function submitCaptcha() {
    const sess = activeSessionRef.current;
    const ctx = activeContextRef.current;
    if (!sess || !ctx) return;
    try {
      setCaptchaSubmitting(true);
      setCaptchaLoading(true);
      const verify = await apiFetch<{ ok: boolean; captcha_image_base64?: string }>(`/api/parse/captcha/verify`, {
        method: 'POST',
        body: JSON.stringify({ parse_session_id: sess.parse_session_id, code: captchaCode }),
      });
      if (!verify.ok) {
        setCaptchaImage(verify.captcha_image_base64 || '');
        setCaptchaCode('');
        message.error('验证码错误，请重试');
        setCaptchaSubmitting(false);
        setTimeout(() => {
          setCaptchaLoading(false);
          captchaInputRef.current?.focus();
        }, 100);
        return;
      }
      await apiFetch(`/api/parse/download`, {
        method: 'POST',
        body: JSON.stringify({
          parse_session_id: sess.parse_session_id,
          url: ctx.item.url,
          projectuuid: ctx.project.projectuuid,
        }),
      });
      setCaptchaCode('');
      message.success(`已解析：${ctx.project.project_name}`);
      const ev = new CustomEvent('parse-step-finished', { detail: { success: true } });
      window.dispatchEvent(ev);
    } catch (err) {
      message.error((err as Error).message || '处理失败');
      setCaptchaSubmitting(false);
      setCaptchaLoading(false);
      const ev = new CustomEvent('parse-step-finished', { detail: { success: false } });
      window.dispatchEvent(ev);
    }
  }

  return (
    <Flex vertical gap={24}>
      <Card className="card" style={{ padding: 24 }}>
        <Row gutter={32}>
          <Col xs={24} md={12} lg={10}>
            <RegionTree value={selectedRegions} onChange={setSelectedRegions} />
          </Col>
          <Col xs={24} md={12} lg={14}>
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <Typography.Paragraph>
                选择需要提取的地区后，点击“按地区筛选”加载命中项目列表，然后点击“开始解析 PDF”按项目顺序下载并提取。
                每次需要输入验证码时会弹出窗口，请按图输入后继续。
              </Typography.Paragraph>
              <Space wrap>
                <Button type="primary" icon={<FilterOutlined />} size="large" onClick={handleFilter}>
                  按地区筛选
                </Button>
                <Button icon={<PlayCircleOutlined />} size="large" onClick={handleStartBatch} disabled={projects.length === 0}>
                  开始解析 PDF
                </Button>
                <Typography.Text type="secondary">
                  当前所选地区：{selectedRegionNames.length === 0 ? '未选择' : selectedRegionNames.join('、')}
                </Typography.Text>
              </Space>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card className="card" style={{ padding: 24 }}>
        <Typography.Title level={4} style={{ marginBottom: 16 }}>
          命中项目列表
        </Typography.Title>
        <Tabs
          activeKey={parsedFilter}
          onChange={handleTabChange}
          items={[
            { key: 'all', label: `全部 (${counts.all}个)` },
            { key: 'parsed', label: `已解析 (${counts.parsed}个)` },
            { key: 'unparsed', label: `未解析 (${counts.unparsed}个)` },
          ]}
          style={{ marginBottom: 16 }}
        />
        <Table<ProjectItem>
          columns={columns}
          dataSource={projects}
          rowKey="projectuuid"
          loading={loading}
          pagination={pagination}
          onChange={handleTableChange}
        />
      </Card>

      <Modal
        title={
          <Space>
            <Badge status="processing" />
            <span>PDF 解析进行中</span>
          </Space>
        }
        open={captchaVisible}
        onCancel={handleStopBatch}
        footer={[
          <Button key="stop" danger icon={<StopOutlined />} onClick={handleStopBatch}>
            停止解析
          </Button>,
          <Button key="submit" type="primary" loading={captchaSubmitting} onClick={submitCaptcha} disabled={!captchaCode.trim() || captchaLoading}>
            提交验证码
          </Button>,
        ]}
        width={560}
        maskClosable={false}
      >
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          <Card size="small" style={{ background: '#f5f5f5' }}>
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                正在解析项目
              </Typography.Text>
              <Typography.Text strong style={{ fontSize: 14 }}>
                {currentProjectName}
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                文件类型：{currentItemName}
              </Typography.Text>
            </Space>
          </Card>

          <div>
            <Typography.Text strong style={{ marginBottom: 8, display: 'block' }}>
              验证码
            </Typography.Text>
            <div
              style={{
                width: '100%',
                height: 300,
                border: '1px solid #d9d9d9',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#fafafa',
                padding: 16,
              }}
            >
              {captchaLoading ? (
                <Spin indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />} />
              ) : captchaImage ? (
                <img src={captchaImage} alt="验证码" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <Typography.Text type="secondary">等待验证码...</Typography.Text>
              )}
            </div>
          </div>

          <Input
            ref={captchaInputRef}
            placeholder="请输入验证码"
            value={captchaCode}
            onChange={(e) => setCaptchaCode(e.target.value)}
            onPressEnter={submitCaptcha}
            size="large"
            disabled={captchaLoading}
          />

          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            输入验证码后点击&ldquo;提交验证码&rdquo;继续，或点击&ldquo;停止解析&rdquo;结束当前批量解析任务。
          </Typography.Text>
        </Space>
      </Modal>

      <ProjectDetailModal
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        projectuuid={selectedProjectUUID}
        allowActions
      />
    </Flex>
  );
}
