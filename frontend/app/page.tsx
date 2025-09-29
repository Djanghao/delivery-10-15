'use client';

import { App, Alert, Button, Card, Col, Flex, Row, Space, Statistic, Typography } from 'antd';
import { HistoryOutlined, DeploymentUnitOutlined } from '@ant-design/icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import RegionTree from '../components/RegionTree';
import LogConsole, { LogEntry } from '../components/LogConsole';
import { apiFetch } from '../lib/api';
import { useSharedRegions } from '../lib/regionsStore';

interface TaskStatus {
  task_id: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  message?: string | null;
}

export default function CrawlDashboard() {
  const { message } = App.useApp();
  const [selectedRegions, setSelectedRegions] = useSharedRegions();
  const [submitting, setSubmitting] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);

  const refreshLogs = useCallback(async () => {
    const data = await apiFetch<LogEntry[]>(`/api/logs?limit=300`);
    setLogs(data);
  }, []);

  const refreshStatuses = useCallback(async () => {
    const data = await apiFetch<TaskStatus[]>(`/api/crawl/status?open_only=true`);
    setStatuses(data);
  }, []);

  // 首次加载：只拉一次状态（无任务时不拉日志）
  useEffect(() => {
    refreshStatuses();
  }, [refreshLogs, refreshStatuses]);

  // 仅在存在进行中/等待中的任务时轮询；无任务则不轮询
  const hasOpenTasks = useMemo(
    () => statuses.some((s) => s.status === 'pending' || s.status === 'running'),
    [statuses],
  );

  useEffect(() => {
    if (!hasOpenTasks) return;
    // 进入活跃期：先立即拉一次，再开始轮询
    refreshLogs();
    refreshStatuses();
    const timer = setInterval(() => {
      refreshLogs();
      refreshStatuses();
    }, 5000);
    return () => clearInterval(timer);
  }, [hasOpenTasks, refreshLogs, refreshStatuses]);

  const pendingCount = useMemo(() => statuses.filter((s) => s.status === 'pending').length, [statuses]);
  const runningCount = useMemo(() => statuses.filter((s) => s.status === 'running').length, [statuses]);

  const handleStart = async (mode: 'history' | 'incremental') => {
    if (selectedRegions.length === 0) {
      message.warning('请先选择至少一个地区');
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch(`/api/crawl/start`, {
        method: 'POST',
        body: JSON.stringify({ mode, regions: selectedRegions }),
      });
      message.success('任务已进入队列');
      refreshStatuses();
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClearLogs = async () => {
    await apiFetch('/api/logs', { method: 'DELETE' });
    await refreshLogs();
  };

  return (
    <Flex vertical gap={24}>
      <Card className="card" style={{ padding: 24 }}>
        <Row gutter={32}>
          <Col xs={24} md={12} lg={10}>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Typography.Title level={5} style={{ margin: 0 }}>地区选择</Typography.Title>
              <RegionTree value={selectedRegions} onChange={setSelectedRegions} />
            </Space>
          </Col>
          <Col xs={24} md={12} lg={14}>
            <Space direction="vertical" size={18} style={{ width: '100%' }}>
              <div>
                <Typography.Title level={5} style={{ margin: 0 }}>任务控制</Typography.Title>
                <Space style={{ marginTop: 12 }} wrap>
                  <Button
                    type="primary"
                    icon={<HistoryOutlined />}
                    size="large"
                    onClick={() => handleStart('history')}
                    loading={submitting}
                  >
                    历史爬取
                  </Button>
                  <Button
                    type="primary"
                    icon={<DeploymentUnitOutlined />}
                    size="large"
                    onClick={() => handleStart('incremental')}
                    loading={submitting}
                  >
                    增量爬取
                  </Button>
                </Space>
              </div>
              <Row gutter={16}>
                <Col span={12} sm={8}>
                  <Card bordered={false} style={{ background: '#f7fbff' }}>
                    <Statistic title="进行中" value={runningCount} valueStyle={{ color: '#1677ff' }} />
                  </Card>
                </Col>
                <Col span={12} sm={8}>
                  <Card bordered={false} style={{ background: '#fffaf5' }}>
                    <Statistic title="等待中" value={pendingCount} valueStyle={{ color: '#fa8c16' }} />
                  </Card>
                </Col>
              </Row>
              {null}
              <Alert
                type="info"
                showIcon
                message="使用说明"
                description={
                  <span>
                    先在左侧选择目标地区（勾选城市会自动包含下属区县，可按需增删），然后点击上方“历史爬取”或“增量爬取”按钮启动任务。
                    历史爬取会补齐历史命中项目；增量爬取仅处理上次 pivot 之后的新增事项，快速捕捉最新变更。
                  </span>
                }
              />
            </Space>
          </Col>
        </Row>
      </Card>

      <LogConsole logs={logs} onRefresh={refreshLogs} onClear={handleClearLogs} />

      {/* 最近任务列表已移除，改由“任务管理”页面展示 */}
    </Flex>
  );
}
