import { useState, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import { Box, CircularProgress, Typography } from '@mui/material';

// CDN worker avoids Vite MIME-type issues with local .mjs resolution
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface Props {
  url: string;
}

export default function PdfViewer({ url }: Props) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  // Keep page width in sync with the container so the PDF fills the dialog
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <Box
      ref={containerRef}
      onContextMenu={(e) => e.preventDefault()}
      sx={{
        maxHeight: 560,
        overflowY: 'auto',
        bgcolor: '#525659',
        borderRadius: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        userSelect: 'text',
        '&::-webkit-scrollbar': { width: 6 },
        '&::-webkit-scrollbar-track': { background: 'transparent' },
        '&::-webkit-scrollbar-thumb': { background: 'rgba(255,255,255,0.3)', borderRadius: 3 },
      }}
    >
      <Document
        file={url}
        onLoadSuccess={({ numPages }) => setNumPages(numPages)}
        loading={
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress sx={{ color: '#F97316' }} />
          </Box>
        }
        error={
          <Box sx={{ p: 3 }}>
            <Typography color="error">Failed to load PDF.</Typography>
          </Box>
        }
      >
        {numPages && containerWidth > 0 &&
          Array.from({ length: numPages }, (_, i) => (
            <Box key={i + 1} sx={{ mb: 0.5 }}>
              <Page
                pageNumber={i + 1}
                width={containerWidth}
                renderTextLayer={true}
                renderAnnotationLayer={false}
              />
            </Box>
          ))}
      </Document>
    </Box>
  );
}
