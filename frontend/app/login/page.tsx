'use client';

import { App, Button, Card, Form, Input, Typography } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import { useEffect } from 'react';

export default function LoginPage() {
  const { message } = App.useApp();
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const [form] = Form.useForm();

  useEffect(() => {
    if (user) {
      router.replace('/');
    }
  }, [user, router]);

  const handleSubmit = async (values: { username: string; password: string }) => {
    try {
      await login(values.username, values.password);
      router.push('/');
    } catch (err) {
      message.error((err as Error).message || 'Login failed');
    }
  };

  if (loading || user) {
    return null;
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <Card
        style={{
          width: 400,
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Typography.Title level={3} style={{ margin: 0, marginBottom: 8 }}>
            投资项目审批爬取系统
          </Typography.Title>
          <Typography.Text type="secondary">请登录以继续</Typography.Text>
        </div>

        <Form form={form} onFinish={handleSubmit} layout="vertical" size="large">
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>

          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              登录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
