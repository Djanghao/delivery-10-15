'use client';

import { Button, Space, Typography } from 'antd';
import { ReloadOutlined, ClearOutlined } from '@ant-design/icons';
import { useEffect, useRef } from 'react';

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
}

type Props = {
  logs: LogEntry[];
  onRefresh: () => void;
  onClear: () => Promise<void>;
};

const levelColor: Record<string, string> = {
  INFO: '#1DA1F2',
  DEBUG: '#8899a6',
  WARNING: '#f6c344',
  ERROR: '#f4212e',
};

export default function LogConsole({ logs, onRefresh, onClear }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
  }, [logs]);

  return (
    <div className="card" style={{ padding: 16, background: '#15202b' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 10 }}>
        <Typography.Title level={5} style={{ margin: 0, color: '#e6ecf0', fontSize: 14 }}>
          爬取日志
        </Typography.Title>
        <Space size="small">
          <Button size="small" icon={<ReloadOutlined />} onClick={onRefresh}>
            刷新
          </Button>
          <Button size="small" icon={<ClearOutlined />} danger onClick={onClear}>
            清空
          </Button>
        </Space>
      </Space>
      <div
        ref={containerRef}
        className="dark-console"
        style={{ maxHeight: 280, overflowY: 'auto', borderRadius: 8, border: '1px solid #273340' }}
      >
        {logs.map((log) => {
          const time = new Date(log.timestamp).toLocaleTimeString('zh-CN', { hour12: false });
          const color = levelColor[log.level] ?? '#8899a6';
          return (
            <p key={`${log.timestamp}-${log.message}`} className="log-message">
              <span style={{ color: '#8899a6', marginRight: 8 }}>[{time}]</span>
              <span style={{ color, marginRight: 8 }}>{log.level}</span>
              <span>{log.message}</span>
            </p>
          );
        })}
        {logs.length === 0 && <Typography.Text style={{ color: '#8899a6' }}>暂无日志</Typography.Text>}
      </div>
    </div>
  );
}
