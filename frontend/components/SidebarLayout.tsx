'use client';

import { Button, Layout, Menu, Typography } from 'antd';
import { DashboardOutlined, TableOutlined, MenuFoldOutlined, MenuUnfoldOutlined, UnorderedListOutlined, FileSearchOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, useState } from 'react';

const { Header, Sider, Content } = Layout;

export default function SidebarLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const selectedKeys = [
    pathname.startsWith('/results')
      ? '/results'
      : pathname.startsWith('/extract')
      ? '/extract'
      : pathname.startsWith('/tasks')
      ? '/tasks'
      : '/',
  ];
  const [collapsed, setCollapsed] = useState(false);

  return (
    <Layout className="app-shell">
      <Sider
        width={200}
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        collapsedWidth={60}
        breakpoint="lg"
        trigger={null}
        style={{
          background: '#ffffff',
          borderRight: '1px solid #e6ecf0',
          boxShadow: '2px 0 8px rgba(15, 20, 25, 0.02)',
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflow: 'auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            padding: '12px',
            minHeight: 56,
            position: 'sticky',
            top: 0,
            zIndex: 1,
            background: '#ffffff',
          }}
        >
          <Button
            type="text"
            aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed((c) => !c)}
          />
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
              key: '/extract',
              icon: <FileSearchOutlined />,
              label: <Link href="/extract">信息提取</Link>,
            },
            {
              key: '/results',
              icon: <TableOutlined />,
              label: <Link href="/results">项目列表</Link>,
            },
            {
              key: '/tasks',
              icon: <UnorderedListOutlined />,
              label: <Link href="/tasks">任务管理</Link>,
            },
          ]}
          style={{ borderRight: 0, background: '#ffffff' }}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: '#ffffff',
            borderBottom: '1px solid #e6ecf0',
            boxShadow: '0 1px 8px rgba(15, 20, 25, 0.03)',
            padding: '0 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: 12,
            height: 56,
          }}
        >
          <Typography.Title level={5} style={{ margin: 0, color: '#374151', fontWeight: 600, fontSize: 15 }}>
            投资项目在线审批监管平台 - 工程建设项目审批爬取系统
          </Typography.Title>
        </Header>
        <Content style={{ padding: '20px 32px', minHeight: 'calc(100vh - 56px)', background: '#f5f8fa' }}>
          <div className="page-container">{children}</div>
        </Content>
      </Layout>
    </Layout>
  );
}
