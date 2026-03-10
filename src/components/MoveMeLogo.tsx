import { useEffect, useState } from 'react';

export function MoveMeLogo({ className = '' }: { className?: string }) {
  const [svgContent, setSvgContent] = useState<string>('');

  useEffect(() => {
    fetch('/moveme-logo-main.svg')
      .then(res => res.text())
      .then(text => {
        const sized = text
          .replace(/width="800"/, 'width="100%"')
          .replace(/height="350"/, 'height="100%"');
        setSvgContent(sized);
      })
      .catch(() => setSvgContent(''));
  }, []);

  if (!svgContent) {
    return <div className={className} />;
  }

  return (
    <div
      className={className}
      style={{ lineHeight: 0 }}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
}
