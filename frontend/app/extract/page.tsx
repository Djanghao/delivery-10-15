'use client';

import { App, Badge, Button, Card, Col, Flex, Image, Input, Modal, Row, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { FilterOutlined, PlayCircleOutlined, StopOutlined } from '@ant-design/icons';
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

  // Captcha modal state
  const [captchaVisible, setCaptchaVisible] = useState(false);
  const [captchaImage, setCaptchaImage] = useState<string>('');
  const [captchaCode, setCaptchaCode] = useState('');
  const [captchaSubmitting, setCaptchaSubmitting] = useState(false);
  const activeSessionRef = useRef<ParseSession | null>(null);
  const activeContextRef = useRef<{ project: ProjectItem; item: ParseDetailItem } | null>(null);
  const stopRequestedRef = useRef(false);

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
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => parseSingleProject(record)} icon={<PlayCircleOutlined />}>解析该项目</Button>
          <Button size="small" onClick={() => { setSelectedProjectUUID(record.projectuuid); setDetailVisible(true); }}>查看详情</Button>
        </Space>
      ),
    },
  ];

  async function openCaptcha(project: ProjectItem, item: ParseDetailItem) {
    const res = await apiFetch<ParseSession>(`/api/parse/captcha/start`, {
      method: 'POST',
      body: JSON.stringify({ projectuuid: project.projectuuid, sendid: item.sendid }),
    });
    activeSessionRef.current = res;
    activeContextRef.current = { project, item };
    setCaptchaImage(res.captcha_image_base64);
    setCaptchaCode('');
    setCaptchaVisible(true);
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
        if (!it.url) continue; // 非文件项跳过
        if (stopRequestedRef.current) break;
        await openCaptcha(project, it);
        // Wait for modal workflow to complete
        await new Promise<void>((resolve, reject) => {
          const handler = (e: CustomEvent<{ success: boolean }>) => {
            window.removeEventListener('parse-step-finished', handler as EventListener);
            if (e.detail.success) resolve();
            else reject(new Error('解析中断'));
          };
          window.addEventListener('parse-step-finished', handler as EventListener);
        });
      }
      // Refresh project list to reflect parsed flag
      await loadProjects(pagination.current ?? 1, pagination.pageSize ?? 20);
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
    for (const p of projects) {
      if (stopRequestedRef.current) break;
      await parseSingleProject(p);
    }
  }

  function handleStopBatch() {
    stopRequestedRef.current = true;
    setCaptchaVisible(false);
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
      // Verified → download & parse
      await apiFetch(`/api/parse/download`, {
        method: 'POST',
        body: JSON.stringify({
          parse_session_id: sess.parse_session_id,
          url: ctx.item.url,
          projectuuid: ctx.project.projectuuid,
        }),
      });
      setCaptchaSubmitting(false);
      setCaptchaVisible(false);
      message.success(`已解析：${ctx.project.project_name}`);
      // Notify waiting promise to continue
      const ev = new CustomEvent('parse-step-finished', { detail: { success: true } });
      window.dispatchEvent(ev);
    } catch (err) {
      message.error((err as Error).message || '处理失败');
      setCaptchaSubmitting(false);
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
                <Button danger icon={<StopOutlined />} size="large" onClick={handleStopBatch}>
                  停止
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
            <Badge color="#1677ff" />
            <span>输入验证码</span>
          </Space>
        }
        open={captchaVisible}
        onCancel={() => {
          setCaptchaVisible(false);
          setCaptchaSubmitting(false);
        }}
        onOk={submitCaptcha}
        confirmLoading={captchaSubmitting}
        okText="提交"
        cancelText="取消"
      >
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Typography.Text>请输入验证码以继续下载并解析当前项目文件。</Typography.Text>
          {captchaImage ? (
            <Image src={captchaImage} alt="验证码" width={140} height={70} style={{ objectFit: 'contain' }} />
          ) : null}
          <Input placeholder="验证码" value={captchaCode} onChange={(e) => setCaptchaCode(e.target.value)} />
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
