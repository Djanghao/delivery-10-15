'use client';

import { App, Button, Dropdown, Form, Input, Layout, Menu, Modal, Space, Typography } from 'antd';
import {
  DashboardOutlined,
  FileSearchOutlined,
  KeyOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  TableOutlined,
  UnorderedListOutlined,
  UserOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, useMemo, useState } from 'react';
import { useAuth } from '../lib/auth';
import { apiFetch } from '../lib/api';

const { Header, Sider, Content } = Layout;

export default function SidebarLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { message } = App.useApp();
  const [changePasswordModalOpen, setChangePasswordModalOpen] = useState(false);
  const [changePasswordForm] = Form.useForm();
  const [collapsed, setCollapsed] = useState(false);

  const selectedKeys = [
    pathname.startsWith('/results')
      ? '/results'
      : pathname.startsWith('/extract')
      ? '/extract'
      : pathname.startsWith('/tasks')
      ? '/tasks'
      : pathname.startsWith('/users')
      ? '/users'
      : '/',
  ];

  const handleChangePassword = async (values: { old_password: string; new_password: string }) => {
    try {
      await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      message.success('密码修改成功');
      setChangePasswordModalOpen(false);
      changePasswordForm.resetFields();
    } catch (err) {
      message.error((err as Error).message);
    }
  };

  const menuItems = useMemo(() => {
    const items = [
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
    ];

    if (user?.role === 'admin') {
      items.push({
        key: '/users',
        icon: <UserOutlined />,
        label: <Link href="/users">用户管理</Link>,
      });
    }

    return items;
  }, [user]);

  if (pathname === '/login') {
    return <>{children}</>;
  }

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
        <Menu mode="inline" selectedKeys={selectedKeys} items={menuItems} style={{ borderRight: 0, background: '#ffffff' }} />
        <div style={{ padding: 12, borderTop: '1px solid #e6ecf0', marginTop: 'auto' }}>
          <Button
            icon={<LogoutOutlined />}
            onClick={logout}
            block
            size="middle"
            style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: 8 }}
          >
            {!collapsed && '退出登录'}
          </Button>
        </div>
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <Typography.Title level={5} style={{ margin: 0, color: '#374151', fontWeight: 600, fontSize: 15 }}>
              投资项目在线审批监管平台 - 工程建设项目审批爬取系统
            </Typography.Title>
            {user && (
              <Dropdown
                menu={{
                  items: [
                    {
                      key: 'change-password',
                      icon: <KeyOutlined />,
                      label: '修改密码',
                      onClick: () => setChangePasswordModalOpen(true),
                    },
                  ],
                }}
              >
                <Space style={{ cursor: 'pointer' }}>
                  <UserOutlined />
                  <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                    {user.username}
                  </Typography.Text>
                </Space>
              </Dropdown>
            )}
          </div>
        </Header>
        <Content style={{ padding: '20px 32px', minHeight: 'calc(100vh - 56px)', background: '#f5f8fa' }}>
          <div className="page-container">{children}</div>
        </Content>
      </Layout>

      <Modal
        title="修改密码"
        open={changePasswordModalOpen}
        onCancel={() => {
          setChangePasswordModalOpen(false);
          changePasswordForm.resetFields();
        }}
        onOk={() => changePasswordForm.submit()}
      >
        <Form form={changePasswordForm} onFinish={handleChangePassword} layout="vertical">
          <Form.Item
            name="old_password"
            label="当前密码"
            rules={[{ required: true, message: '请输入当前密码' }]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item
            name="new_password"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码至少6位' },
            ]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item
            name="confirm_password"
            label="确认新密码"
            dependencies={['new_password']}
            rules={[
              { required: true, message: '请确认新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('new_password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
}
