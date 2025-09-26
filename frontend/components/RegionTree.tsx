'use client';

import { Tree, Typography, Spin } from 'antd';
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
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [loading, setLoading] = useState(false);

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

  return (
    <div>
      <div
        style={{
          maxHeight: 320,
          overflow: 'auto',
          marginTop: 12,
          border: '1px solid #e6ecf0',
          borderRadius: 12,
          padding: 12,
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
