'use client';

import { ClockCircleOutlined, RocketOutlined } from '@ant-design/icons';
import { Badge, List, Space, Tag, Typography } from 'antd';

export interface CrawlRunItem {
  id: string;
  mode: string;
  regions: string[];
  region_count: number;
  total_items: number;
  valuable_projects: number;
  started_at: string;
  finished_at?: string | null;
}

type Props = {
  runs: CrawlRunItem[];
};

function modeTag(mode: string) {
  if (mode === 'history') {
    return <Tag color="blue">历史模式</Tag>;
  }
  return <Tag color="cyan">增量模式</Tag>;
}

export default function RunHistoryList({ runs }: Props) {
  return (
    <div className="card" style={{ padding: 24 }}>
      <Typography.Title level={4} style={{ marginBottom: 16 }}>
        最近任务
      </Typography.Title>
      <List
        itemLayout="vertical"
        dataSource={runs}
        locale={{ emptyText: '暂无任务记录' }}
        renderItem={(item) => {
          const start = new Date(item.started_at).toLocaleString('zh-CN', { hour12: false });
          const finish = item.finished_at
            ? new Date(item.finished_at).toLocaleString('zh-CN', { hour12: false })
            : '执行中';
          return (
            <List.Item key={item.id} style={{ borderBlockEnd: '1px solid #f0f0f0' }}>
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <Space align="center" size={8}>
                  <RocketOutlined style={{ color: '#1DA1F2' }} />
                  <Typography.Text strong>任务编号：{item.id.slice(0, 8)}</Typography.Text>
                  {modeTag(item.mode)}
                  <Badge count={`${item.region_count} 个地区`} style={{ backgroundColor: '#657786' }} />
                </Space>
                <Space size={12} wrap>
                  <Typography.Text type="secondary">
                    <ClockCircleOutlined style={{ marginRight: 4 }} /> 启动：{start}
                  </Typography.Text>
                  <Typography.Text type="secondary">结束：{finish}</Typography.Text>
                  <Typography.Text>处理事项：{item.total_items}</Typography.Text>
                  <Typography.Text>命中项目：{item.valuable_projects}</Typography.Text>
                </Space>
                <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                  覆盖地区：{item.regions.join(', ')}
                </Typography.Paragraph>
              </Space>
            </List.Item>
          );
        }}
      />
    </div>
  );
}
