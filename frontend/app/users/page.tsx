'use client';

import { useEffect, useState } from 'react';
import { App, Button, Card, Form, Input, Modal, Select, Space, Switch, Table, Tag, Typography } from 'antd';
import { PlusOutlined, UserOutlined } from '@ant-design/icons';
import { useAuth } from '../../lib/auth';
import { apiFetch } from '../../lib/api';
import { useRouter } from 'next/navigation';

interface User {
  id: number;
  username: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export default function UsersPage() {
  const { message, modal } = App.useApp();
  const { user: currentUser } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [resetPasswordModalOpen, setResetPasswordModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [form] = Form.useForm();
  const [resetPasswordForm] = Form.useForm();

  useEffect(() => {
    if (currentUser?.role !== 'admin') {
      router.push('/');
      return;
    }
    fetchUsers();
  }, [currentUser, router]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<User[]>('/api/users');
      setUsers(data);
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (values: { username: string; password: string; role: string }) => {
    try {
      await apiFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      message.success('User created successfully');
      setCreateModalOpen(false);
      form.resetFields();
      fetchUsers();
    } catch (err) {
      message.error((err as Error).message);
    }
  };

  const handleToggleActive = async (userId: number, isActive: boolean) => {
    try {
      await apiFetch(`/api/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !isActive }),
      });
      message.success('User status updated');
      fetchUsers();
    } catch (err) {
      message.error((err as Error).message);
    }
  };

  const handleDelete = async (userId: number, username: string) => {
    modal.confirm({
      title: 'Delete User',
      content: `Are you sure you want to delete user "${username}"?`,
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await apiFetch(`/api/users/${userId}`, { method: 'DELETE' });
          message.success('User deleted');
          fetchUsers();
        } catch (err) {
          message.error((err as Error).message);
        }
      },
    });
  };

  const handleResetPassword = async (values: { new_password: string }) => {
    if (!selectedUser) return;
    try {
      await apiFetch(`/api/users/${selectedUser.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ new_password: values.new_password }),
      });
      message.success('Password reset successfully');
      setResetPasswordModalOpen(false);
      resetPasswordForm.resetFields();
      setSelectedUser(null);
    } catch (err) {
      message.error((err as Error).message);
    }
  };

  if (currentUser?.role !== 'admin') {
    return null;
  }

  return (
    <div>
      <Card>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            用户管理
          </Typography.Title>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            创建用户
          </Button>
        </div>

        <Table
          dataSource={users}
          loading={loading}
          rowKey="id"
          columns={[
            {
              title: '用户名',
              dataIndex: 'username',
              key: 'username',
              render: (text, record) => (
                <Space>
                  <UserOutlined />
                  <span>{text}</span>
                  {record.username === 'admin' && <Tag color="gold">ADMIN</Tag>}
                </Space>
              ),
            },
            {
              title: '角色',
              dataIndex: 'role',
              key: 'role',
              render: (role) => <Tag color={role === 'admin' ? 'red' : 'blue'}>{role}</Tag>,
            },
            {
              title: '状态',
              dataIndex: 'is_active',
              key: 'is_active',
              render: (isActive, record) => (
                <Switch
                  checked={isActive}
                  disabled={record.username === 'admin'}
                  onChange={() => handleToggleActive(record.id, isActive)}
                />
              ),
            },
            {
              title: '创建时间',
              dataIndex: 'created_at',
              key: 'created_at',
              render: (text) => new Date(text).toLocaleString('zh-CN'),
            },
            {
              title: '操作',
              key: 'actions',
              render: (_, record) => (
                <Space>
                  <Button
                    size="small"
                    onClick={() => {
                      setSelectedUser(record);
                      setResetPasswordModalOpen(true);
                    }}
                  >
                    重置密码
                  </Button>
                  <Button
                    danger
                    size="small"
                    disabled={record.username === 'admin'}
                    onClick={() => handleDelete(record.id, record.username)}
                  >
                    删除
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title="创建用户"
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
      >
        <Form form={form} onFinish={handleCreate} layout="vertical">
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="role" label="角色" initialValue="user" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="user">User</Select.Option>
              <Select.Option value="admin">Admin</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`重置密码 - ${selectedUser?.username}`}
        open={resetPasswordModalOpen}
        onCancel={() => {
          setResetPasswordModalOpen(false);
          resetPasswordForm.resetFields();
          setSelectedUser(null);
        }}
        onOk={() => resetPasswordForm.submit()}
      >
        <Form form={resetPasswordForm} onFinish={handleResetPassword} layout="vertical">
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
        </Form>
      </Modal>
    </div>
  );
}
