'use client';

import { Layout, Menu, Typography } from 'antd';
import {
  ApartmentOutlined,
  DashboardOutlined,
  TableOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const { Header, Sider, Content } = Layout;

export default function SidebarLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const selectedKeys = pathname === '/results' ? ['/results'] : ['/'];

  return (
    <Layout className="app-shell">
      <Sider
        width={220}
        style={{
          background: '#ffffff',
          borderRight: '1px solid #e6ecf0',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '24px 16px 16px',
          }}
        >
          <ApartmentOutlined style={{ fontSize: 24, color: '#1DA1F2' }} />
          <Typography.Title level={4} style={{ margin: 0 }}>
            审批爬取
          </Typography.Title>
        </div>
        <Menu
          mode="inline"
          selectedKeys={selectedKeys}
          items={[
            {
              key: '/',
              icon: <DashboardOutlined />,
              label: <Link href="/">数据爬取</Link>,
            },
            {
              key: '/results',
              icon: <TableOutlined />,
              label: <Link href="/results">爬取结果</Link>,
            },
          ]}
          style={{ borderRight: 0, background: '#ffffff' }}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: '#ffffffcc',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid #e6ecf0',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Typography.Title level={3} style={{ margin: 0, color: '#15202b' }}>
            浙江审批项目智能爬取平台
          </Typography.Title>
          <Typography.Text type="secondary">内测版本</Typography.Text>
        </Header>
        <Content style={{ padding: '24px 32px', minHeight: 'calc(100vh - 64px)' }}>
          <div className="page-container">{children}</div>
        </Content>
      </Layout>
    </Layout>
  );
}
