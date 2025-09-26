import type { Metadata } from 'next';
import Providers from '../components/Providers';
import SidebarLayout from '../components/SidebarLayout';
import './globals.css';
import AntdRegistry from './antd-registry';

export const metadata: Metadata = {
  title: '浙江审批项目爬取平台',
  description: '面向审批管理系统的定制化爬取管控平台',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hans">
      <body>
        <AntdRegistry>
          <Providers>
            <SidebarLayout>{children}</SidebarLayout>
          </Providers>
        </AntdRegistry>
      </body>
    </html>
  );
}
