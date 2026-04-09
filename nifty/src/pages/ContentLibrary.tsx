import { useState } from 'react';
import { Box, Typography, Button, Grid, Skeleton } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { contentApi } from '@/api/content';
import ContentCard from '@/components/Content/ContentCard';
import ContentViewDialog from '@/components/Content/ContentViewDialog';
import { ContentFilters } from '@/constants';
import type { ContentType, ContentScope } from '@/types';

type Filter = 'all' | ContentType | ContentScope;

export default function ContentLibrary() {
  const [filter, setFilter] = useState<Filter>('all');
  const [viewingId, setViewingId] = useState<string | null>(null);

  const queryParams =
    filter === 'all'
      ? {}
      : filter === 'global'
        ? { scope: 'global' as ContentScope }
        : { type: filter as ContentType };

  const { data: contentList = [], isLoading } = useQuery({
    queryKey: ['content', queryParams],
    queryFn: () => contentApi.list(queryParams),
  });

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 0.5 }}>
        Content Library
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2.5 }}>
        Browse all available learning content
      </Typography>

      {/* Filter bar */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
        {ContentFilters.map((f) => (
          <Button
            key={f.value}
            size="small"
            onClick={() => setFilter(f.value)}
            sx={{
              borderRadius: 50,
              fontSize: '0.82rem',
              px: 2,
              py: 0.75,
              fontWeight: filter === f.value ? 800 : 600,
              background: filter === f.value ? f.bg : 'transparent',
              color: filter === f.value ? f.color : 'text.secondary',
              border: `2px solid ${filter === f.value ? f.bg : '#FED7AA'}`,
              '&:hover': { background: f.bg, color: f.color },
            }}
          >
            {f.label}
          </Button>
        ))}
      </Box>

      {/* Grid */}
      <Grid container spacing={2.5}>
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={i}>
              <Skeleton variant="rounded" height={200} sx={{ borderRadius: 2 }} />
            </Grid>
          ))
          : contentList.map((c) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={c.id}>
              <ContentCard content={c} onClick={(c) => setViewingId(c.id)} />
            </Grid>
          ))}
        {!isLoading && contentList.length === 0 && (
          <Grid size={{ xs: 12 }}>
            <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
              <Typography>No {filter !== 'all' ? filter : ''} content found.</Typography>
            </Box>
          </Grid>
        )}
      </Grid>

      <ContentViewDialog contentId={viewingId} onClose={() => setViewingId(null)} />
    </Box>
  );
}
