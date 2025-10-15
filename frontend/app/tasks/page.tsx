'use client';

import { App, Badge, Button, Card, Empty, Flex, List, Segmented, Space, Tag, Typography } from 'antd';
import { CheckCircleTwoTone, ClockCircleOutlined, PauseCircleTwoTone, StopOutlined } from '@ant-design/icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../lib/api';

type TaskStatus = {
  task_id: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  message?: string | null;
  run_id?: string | null;
  mode?: 'history' | 'incremental' | string;
  regions?: string[];
  started_at?: string | null;
  finished_at?: string | null;
};

type CrawlRunItem = {
  id: string;
  mode: string;
  regions: string[];
  region_count: number;
  total_items: number;
  valuable_projects: number;
  started_at: string;
  finished_at?: string | null;
};

type ViewMode = 'open' | 'closed';

function modeTag(mode?: string) {
  if (mode === 'history') return <Tag color="blue">历史模式</Tag>;
  if (mode === 'incremental') return <Tag color="cyan">增量模式</Tag>;
  return null;
}

export default function TasksPage() {
  const { message } = App.useApp();
  const [view, setView] = useState<ViewMode>('open');
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [runs, setRuns] = useState<CrawlRunItem[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [s, r] = await Promise.all([
        apiFetch<TaskStatus[]>('/api/crawl/status?open_only=true'),
        apiFetch<CrawlRunItem[]>('/api/crawl/runs'),
      ]);
      setStatuses(s);
      setRuns(r);
    } finally {
      setLoading(false);
    }
  }, []);

  // 首次加载：拉一次数据
  useEffect(() => {
    refresh();
  }, [refresh]);

  // 仅在存在进行中/等待中的任务时轮询；无任务则不轮询
  const hasOpenTasks = useMemo(
    () => statuses.some((t) => t.status === 'pending' || t.status === 'running'),
    [statuses],
  );

  useEffect(() => {
    if (!hasOpenTasks) return;
    const timer = setInterval(refresh, 4000);
    return () => clearInterval(timer);
  }, [hasOpenTasks, refresh]);

  const openTasks = useMemo(
    () => statuses.filter((t) => t.status === 'pending' || t.status === 'running'),
    [statuses],
  );
  const closedRuns = useMemo(() => runs.filter((r) => !!r.finished_at), [runs]);

  const runMap = useMemo(() => new Map(runs.map((r) => [r.id, r])), [runs]);

  const handleStop = async (taskId: string) => {
    try {
      await apiFetch(`/api/crawl/stop/${taskId}`, { method: 'POST' });
      message.success('已请求结束任务');
      refresh();
    } catch (err) {
      message.error((err as Error).message);
    }
  };

  return (
    <Flex vertical gap={16}>
      <Card className="card" style={{ padding: '16px 20px' }}>
        <Segmented
          value={view}
          onChange={(val) => setView(val as ViewMode)}
          options={[
            { label: `进行中 (${openTasks.length})`, value: 'open' },
            { label: `已结束 (${closedRuns.length})`, value: 'closed' },
          ]}
          size="middle"
          style={{ fontWeight: 500 }}
        />
      </Card>

      {view === 'open' ? (
        <Card className="card" style={{ padding: '20px' }} loading={loading}>
          {openTasks.length === 0 ? (
            <Empty
              description={<span style={{ color: '#8c8c8c', fontSize: 13 }}>暂无进行中的任务</span>}
              style={{ padding: '40px 0' }}
            />
          ) : (
            <List
              itemLayout="vertical"
              dataSource={openTasks}
              split={false}
              renderItem={(t) => {
                const shortId = (t.run_id ?? t.task_id).slice(0, 8);
                const run = t.run_id ? runMap.get(t.run_id) : undefined;
                const start = t.started_at
                  ? new Date(t.started_at).toLocaleString('zh-CN', { hour12: false })
                  : '等待中';
                const finish = t.finished_at
                  ? new Date(t.finished_at).toLocaleString('zh-CN', { hour12: false })
                  : '—';
                return (
                  <List.Item
                    key={t.task_id}
                    style={{
                      padding: '14px',
                      marginBottom: 12,
                      background: '#fafafa',
                      borderRadius: 8,
                      border: '1px solid #f0f0f0',
                      transition: 'all 0.3s ease',
                    }}
                    className="task-list-item"
                  >
                    <Space direction="vertical" size={10} style={{ width: '100%' }}>
                      <Flex align="center" gap={10} wrap="wrap">
                        {t.status === 'running' ? (
                          <PauseCircleTwoTone twoToneColor="#1DA1F2" style={{ fontSize: 18 }} />
                        ) : (
                          <ClockCircleOutlined style={{ color: '#657786', fontSize: 18 }} />
                        )}
                        <Typography.Text strong style={{ fontSize: 14 }}>
                          任务编号：{shortId}
                        </Typography.Text>
                        {modeTag(t.mode)}
                        <Badge
                          count={`${t.regions?.length ?? run?.region_count ?? 0} 个地区`}
                          style={{ backgroundColor: '#52c41a', fontSize: 12 }}
                        />
                      </Flex>
                      <Flex gap={16} wrap="wrap" style={{ fontSize: 13 }}>
                        <Space size={6}>
                          <Typography.Text type="secondary">启动：</Typography.Text>
                          <Typography.Text>{start}</Typography.Text>
                        </Space>
                        <Space size={6}>
                          <Typography.Text type="secondary">结束：</Typography.Text>
                          <Typography.Text>{finish}</Typography.Text>
                        </Space>
                        <Space size={6}>
                          <Typography.Text type="secondary">处理事项：</Typography.Text>
                          <Typography.Text strong style={{ color: '#1DA1F2' }}>
                            {run?.total_items ?? 0}
                          </Typography.Text>
                        </Space>
                        <Space size={6}>
                          <Typography.Text type="secondary">命中项目：</Typography.Text>
                          <Typography.Text strong style={{ color: '#52c41a' }}>
                            {run?.valuable_projects ?? 0}
                          </Typography.Text>
                        </Space>
                      </Flex>
                      <div>
                        <Button
                          danger
                          icon={<StopOutlined />}
                          onClick={() => handleStop(t.task_id)}
                          size="small"
                        >
                          结束任务
                        </Button>
                      </div>
                    </Space>
                  </List.Item>
                );
              }}
            />
          )}
        </Card>
      ) : (
        <Card className="card" style={{ padding: '20px' }} loading={loading}>
          {closedRuns.length === 0 ? (
            <Empty
              description={<span style={{ color: '#8c8c8c', fontSize: 13 }}>暂无已结束的任务</span>}
              style={{ padding: '40px 0' }}
            />
          ) : (
            <List
              itemLayout="vertical"
              dataSource={closedRuns}
              split={false}
              renderItem={(item) => {
                const start = new Date(item.started_at).toLocaleString('zh-CN', { hour12: false });
                const finish = item.finished_at
                  ? new Date(item.finished_at).toLocaleString('zh-CN', { hour12: false })
                  : '—';
                return (
                  <List.Item
                    key={item.id}
                    style={{
                      padding: '14px',
                      marginBottom: 12,
                      background: '#fafafa',
                      borderRadius: 8,
                      border: '1px solid #f0f0f0',
                      transition: 'all 0.3s ease',
                    }}
                    className="task-list-item"
                  >
                    <Space direction="vertical" size={10} style={{ width: '100%' }}>
                      <Flex align="center" gap={10} wrap="wrap">
                        <CheckCircleTwoTone twoToneColor="#52c41a" style={{ fontSize: 18 }} />
                        <Typography.Text strong style={{ fontSize: 14 }}>
                          任务编号：{item.id.slice(0, 8)}
                        </Typography.Text>
                        {modeTag(item.mode)}
                        <Badge
                          count={`${item.region_count} 个地区`}
                          style={{ backgroundColor: '#52c41a', fontSize: 12 }}
                        />
                      </Flex>
                      <Flex gap={16} wrap="wrap" style={{ fontSize: 13 }}>
                        <Space size={6}>
                          <Typography.Text type="secondary">启动：</Typography.Text>
                          <Typography.Text>{start}</Typography.Text>
                        </Space>
                        <Space size={6}>
                          <Typography.Text type="secondary">结束：</Typography.Text>
                          <Typography.Text>{finish}</Typography.Text>
                        </Space>
                        <Space size={6}>
                          <Typography.Text type="secondary">处理事项：</Typography.Text>
                          <Typography.Text strong style={{ color: '#1DA1F2' }}>
                            {item.total_items}
                          </Typography.Text>
                        </Space>
                        <Space size={6}>
                          <Typography.Text type="secondary">命中项目：</Typography.Text>
                          <Typography.Text strong style={{ color: '#52c41a' }}>
                            {item.valuable_projects}
                          </Typography.Text>
                        </Space>
                      </Flex>
                      <Typography.Paragraph
                        type="secondary"
                        style={{
                          marginBottom: 0,
                          fontSize: 12,
                          padding: '6px 10px',
                          background: 'white',
                          borderRadius: 6,
                        }}
                      >
                        <span style={{ fontWeight: 500 }}>覆盖地区：</span>
                        {item.regions.join(', ')}
                      </Typography.Paragraph>
                    </Space>
                  </List.Item>
                );
              }}
            />
          )}
        </Card>
      )}
    </Flex>
  );
}
