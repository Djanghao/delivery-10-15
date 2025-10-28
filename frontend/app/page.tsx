'use client';

import { App, Alert, Button, Card, Col, Flex, Row, Select, Space, Statistic, Typography } from 'antd';
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
  const [logMode, setLogMode] = useState<'detailed' | 'simple'>('detailed');
  const [excludeKeywords, setExcludeKeywords] = useState<string[]>(['分布式光伏']);

  const refreshLogs = useCallback(async (mode?: 'detailed' | 'simple') => {
    const actualMode = mode ?? logMode;
    const data = await apiFetch<LogEntry[]>(`/api/logs?limit=300&mode=${actualMode}`);
    setLogs(data);
  }, [logMode]);

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
        body: JSON.stringify({ mode, regions: selectedRegions, exclude_keywords: excludeKeywords.join(',') }),
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
    <Flex vertical gap={16}>
      <Card className="card" style={{ padding: 16 }}>
        <Row gutter={24} style={{ alignItems: 'stretch' }}>
          <Col xs={24} md={14} lg={12} style={{ display: 'flex' }}>
            <RegionTree value={selectedRegions} onChange={setSelectedRegions} />
          </Col>
          <Col xs={24} md={10} lg={12} style={{ display: 'flex' }}>
            <Flex vertical justify="space-between" style={{ width: '100%' }}>
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Typography.Title level={5} style={{ margin: 0, fontSize: 14 }}>任务控制</Typography.Title>
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <Typography.Text style={{ fontSize: 12 }}>过滤项目名称</Typography.Text>
                  <Select
                    mode="tags"
                    placeholder="选择或输入要排除的关键词"
                    value={excludeKeywords}
                    onChange={setExcludeKeywords}
                    size="small"
                    style={{ width: '100%' }}
                    options={[
                      { value: '分布式光伏', label: '分布式光伏' },
                    ]}
                  />
                </Space>
                <Row gutter={12}>
                  <Col span={12}>
                    <Button
                      type="primary"
                      icon={<HistoryOutlined />}
                      size="middle"
                      onClick={() => handleStart('history')}
                      loading={submitting}
                      block
                    >
                      历史爬取
                    </Button>
                  </Col>
                  <Col span={12}>
                    <Button
                      type="primary"
                      icon={<DeploymentUnitOutlined />}
                      size="middle"
                      onClick={() => handleStart('incremental')}
                      loading={submitting}
                      block
                    >
                      增量爬取
                    </Button>
                  </Col>
                </Row>
                <Row gutter={12}>
                  <Col span={12}>
                    <Card bordered={false} style={{ background: '#f7fbff', padding: 12 }}>
                      <Statistic title="进行中" value={runningCount} valueStyle={{ color: '#1677ff', fontSize: 20 }} />
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card bordered={false} style={{ background: '#fffaf5', padding: 12 }}>
                      <Statistic title="等待中" value={pendingCount} valueStyle={{ color: '#fa8c16', fontSize: 20 }} />
                    </Card>
                  </Col>
                </Row>
              </Space>
              <Alert
                type="info"
                showIcon
                message="使用说明"
                description={
                  <span style={{ fontSize: 12 }}>
                    先在左侧选择目标地区（勾选城市会自动包含下属区县，可按需增删），然后点击上方&ldquo;历史爬取&rdquo;或&ldquo;增量爬取&rdquo;按钮启动任务。
                    历史爬取会补齐历史命中项目；增量爬取仅处理上次 pivot 之后的新增事项，快速捕捉最新变更。
                  </span>
                }
              />
            </Flex>
          </Col>
        </Row>
      </Card>

      <LogConsole logs={logs} mode={logMode} onModeChange={setLogMode} onRefresh={refreshLogs} onClear={handleClearLogs} />

      {/* 最近任务列表已移除，改由"任务管理"页面展示 */}
    </Flex>
  );
}
