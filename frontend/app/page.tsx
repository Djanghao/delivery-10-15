'use client';

import { App, Button, Card, Col, Flex, Row, Segmented, Space, Tag, Typography } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import RegionTree from '../components/RegionTree';
import LogConsole, { LogEntry } from '../components/LogConsole';
import { apiFetch } from '../lib/api';

interface TaskStatus {
  task_id: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  message?: string | null;
}

type CrawlMode = 'history' | 'incremental';

export default function CrawlDashboard() {
  const { message } = App.useApp();
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [mode, setMode] = useState<CrawlMode>('history');
  const [submitting, setSubmitting] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);

  const refreshLogs = useCallback(async () => {
    const data = await apiFetch<LogEntry[]>(`/api/logs?limit=300`);
    setLogs(data);
  }, []);

  const refreshStatuses = useCallback(async () => {
    const data = await apiFetch<TaskStatus[]>(`/api/crawl/status`);
    setStatuses(data);
  }, []);

  useEffect(() => {
    refreshLogs();
    refreshStatuses();
    const timer = setInterval(() => {
      refreshLogs();
      refreshStatuses();
    }, 5000);
    return () => clearInterval(timer);
  }, [refreshLogs, refreshStatuses]);

  const activeTasks = useMemo(
    () => statuses.filter((item) => item.status === 'pending' || item.status === 'running'),
    [statuses],
  );

  const handleStart = async () => {
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
            <RegionTree value={selectedRegions} onChange={setSelectedRegions} />
          </Col>
          <Col xs={24} md={12} lg={14}>
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <div>
                <Typography.Text strong>爬取模式</Typography.Text>
                <Segmented
                  style={{ marginTop: 12 }}
                  block
                  value={mode}
                  onChange={(value) => setMode(value as CrawlMode)}
                  options={[
                    { label: '历史模式', value: 'history' },
                    { label: '增量模式', value: 'incremental' },
                  ]}
                />
              </div>
              <Space size={12} wrap>
                <Button
                  type="primary"
                  icon={<ThunderboltOutlined />}
                  size="large"
                  onClick={handleStart}
                  loading={submitting}
                >
                  开始爬取
                </Button>
                <Space size={8} wrap>
                  {activeTasks.map((task) => (
                    <Tag key={task.task_id} color={task.status === 'running' ? 'blue' : 'gold'}>
                      {task.status === 'running' ? '执行中' : '等待中'} #{task.task_id.slice(0, 6)}
                    </Tag>
                  ))}
                </Space>
              </Space>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                选中城市时会自动包含其下属区县，可单独勾选或取消区县以细化范围。
              </Typography.Paragraph>
            </Space>
          </Col>
        </Row>
      </Card>

      <LogConsole logs={logs} onRefresh={refreshLogs} onClear={handleClearLogs} />

      {/* 最近任务列表已移除，改由“任务管理”页面展示 */}
    </Flex>
  );
}
