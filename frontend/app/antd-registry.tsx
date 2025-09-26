'use client';

import { StyleProvider, createCache, extractStyle } from '@ant-design/cssinjs';
import { useServerInsertedHTML } from 'next/navigation';
import { useMemo } from 'react';

export default function AntdRegistry({ children }: { children: React.ReactNode }) {
  const cache = useMemo(() => createCache(), []);

  useServerInsertedHTML(() => {
    return (
      <style
        id="antd-css-server-side"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: extractStyle(cache, true) }}
      />
    );
  });

  return <StyleProvider cache={cache}>{children}</StyleProvider>;
}

