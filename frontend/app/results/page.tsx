'use client';

import { App, Button, Card, Col, Flex, Row, Space, Table, Typography } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { DownloadOutlined, FilterOutlined } from '@ant-design/icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import RegionTree from '../../components/RegionTree';
import { apiFetch, API_BASE } from '../../lib/api';

interface ProjectItem {
  projectuuid: string;
  project_name: string;
  region_code: string;
  discovered_at: string;
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
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [pagination, setPagination] = useState<TablePaginationConfig>({ current: 1, pageSize: 20, total: 0 });
  const [loading, setLoading] = useState(false);
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
  ];

  const handleExport = () => {
    if (selectedRegions.length === 0) {
      message.warning('请选择至少一个地区再导出');
      return;
    }
    const params = new URLSearchParams();
    selectedRegions.forEach((region) => params.append('regions', region));
    window.open(`${API_BASE}/api/projects/export?${params.toString()}`, '_blank');
  };

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
                选择需要查看的地区后，点击“筛选结果”以加载对应的命中项目列表，可导出为 CSV 用于进一步分析。
              </Typography.Paragraph>
              <Space>
                <Button type="primary" icon={<FilterOutlined />} size="large" onClick={handleFilter}>
                  筛选结果
                </Button>
                <Button icon={<DownloadOutlined />} size="large" onClick={handleExport}>
                  导出CSV
                </Button>
              </Space>
              <Typography.Text type="secondary">
                当前所选地区：{selectedRegions.length === 0 ? '未选择' : selectedRegions.join('、')}
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
    </Flex>
  );
}
