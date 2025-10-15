'use client';

import { App, Button, Card, Col, Flex, Popconfirm, Row, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { DeleteOutlined, DownloadOutlined, FilterOutlined } from '@ant-design/icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import RegionTree from '../../components/RegionTree';
import { apiFetch, API_BASE } from '../../lib/api';
import { useSharedRegions } from '../../lib/regionsStore';
import ProjectDetailModal from '../../components/ProjectDetailModal';

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
  }, [flattenRegions]);

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
    [selectedRegions],
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
      key: 'status',
      render: (_, record) => (
        record.parsed_pdf ? <Tag color="green">已解析PDF</Tag> : <Tag>未解析</Tag>
      ),
    },
    {
      title: '解析',
      key: 'parse',
      render: (_, record) => (
        <Button size="small">解析该项目</Button>
      ),
    },
    {
      title: '查看',
      key: 'detail',
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
    setSelectedProjectUUID(projectuuid);
    setDetailVisible(true);
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
                选择需要查看的地区后，点击“按地区筛选”以加载对应的项目列表，可使用“导出筛选结果”下载 CSV 用于进一步分析。
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
          项目列表
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

      {/* Detail modal */}
      <ProjectDetailModal open={detailVisible} onClose={() => setDetailVisible(false)} projectuuid={selectedProjectUUID} allowActions />
    </Flex>
  );
}
