'use client';

import { Tree, Typography, Spin, Button, Space, App } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

interface RegionNode {
  id: string;
  name: string;
  children?: RegionNode[];
}

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
};

function toTreeData(nodes: RegionNode[]): DataNode[] {
  return nodes.map((node) => ({
    key: node.id,
    title: node.name,
    children: node.children ? toTreeData(node.children) : undefined,
  }));
}

export default function RegionTree({ value, onChange }: Props) {
  const { message } = App.useApp();
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const regions = await apiFetch<RegionNode[]>('/api/regions');
        if (mounted) {
          setTreeData(toTreeData(regions));
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const regions = await apiFetch<RegionNode[]>('/api/regions/refresh', { method: 'POST' });
      setTreeData(toTreeData(regions));
      message.success('地区列表已刷新');
      try {
        window.dispatchEvent(new Event('regions-refreshed'));
      } catch {}
    } catch (err) {
      message.error((err as Error).message || '刷新失败');
    } finally {
      setRefreshing(false);
    }
  };

  const getAllKeys = (nodes: DataNode[]): string[] => {
    const keys: string[] = [];
    const traverse = (n: DataNode[]) => {
      for (const node of n) {
        keys.push(node.key as string);
        if (node.children) traverse(node.children);
      }
    };
    traverse(nodes);
    return keys;
  };

  const handleSelectAll = () => {
    const allKeys = getAllKeys(treeData);
    onChange(allKeys);
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const allKeys = getAllKeys(treeData);
  const isAllSelected = allKeys.length > 0 && value.length === allKeys.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
        <Typography.Text strong>地区列表</Typography.Text>
        <Space size="small">
          <Button
            size="small"
            type={isAllSelected ? 'default' : 'primary'}
            onClick={isAllSelected ? handleClearAll : handleSelectAll}
          >
            {isAllSelected ? '取消全选' : '全选'}
          </Button>
          <Button size="small" icon={<ReloadOutlined />} onClick={handleRefresh} loading={refreshing}>
            刷新
          </Button>
        </Space>
      </Space>
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          marginTop: 8,
          border: '1px solid #e6ecf0',
          borderRadius: 8,
          padding: 10,
          background: '#fff',
        }}
      >
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
            <Spin tip="加载地区..." />
          </div>
        ) : (
          <Tree
            checkable
            selectable={false}
            checkedKeys={value}
            treeData={treeData}
            onCheck={(keys) => {
              const checked = Array.isArray(keys) ? (keys as string[]) : (keys as { checked: string[] }).checked;
              onChange(checked);
            }}
          />
        )}
      </div>
    </div>
  );
}
