'use client';

import { App as AntdApp, ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import type { ReactNode } from 'react';

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1DA1F2',
          colorBgLayout: '#f5f8fa',
          colorBgContainer: '#ffffff',
          colorBorder: '#e6ecf0',
          colorText: '#15202b',
          colorTextSecondary: '#667085',
          borderRadius: 12,
          fontFamily: 'inherit',
          boxShadow: '0 8px 24px rgba(15, 20, 25, 0.08)',
          boxShadowSecondary: '0 2px 8px rgba(15, 20, 25, 0.08)',
          controlHeight: 36,
          controlHeightLG: 40,
        },
        components: {
          Layout: {
            headerBg: '#ffffff',
            siderBg: '#ffffff',
            headerHeight: 72,
          },
          Menu: {
            itemSelectedBg: '#e8f4ff',
            itemHoverBg: '#f5f8fa',
            itemSelectedColor: '#1677ff',
            itemBorderRadius: 8,
          },
          Card: {
            borderRadiusLG: 16,
            colorBorderSecondary: '#e6ecf0',
          },
          Table: {
            headerBg: '#f7f9fc',
            headerColor: '#213547',
            rowHoverBg: '#f7fbff',
            borderColor: '#eef2f5',
          },
          Modal: {
            borderRadiusLG: 14,
          },
          Button: {
            borderRadius: 10,
          },
          Tag: {
            borderRadiusSM: 6,
          },
          Input: {
            borderRadius: 10,
          },
          Tree: {
            directoryNodeSelectedColor: '#1677ff',
          },
        },
      }}
    >
      <AntdApp>{children}</AntdApp>
    </ConfigProvider>
  );
}
