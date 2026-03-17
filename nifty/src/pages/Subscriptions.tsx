import { useState } from 'react';
import {
  Box,
  Typography,
  Chip,
  Skeleton,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  LinearProgress,
  Alert,
  Button,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { subscriptionsApi } from '@/api/subscriptions';
import { useAuthStore } from '@/store/authStore';
import { SubscriptionStyle, SubscriptionPlan } from '@/constants';
import type { OrgSubscription, StudentSubscription } from '@/types';

function PlanChip({ plan }: { plan: string }) {
  const s = SubscriptionStyle.plan[plan as keyof typeof SubscriptionStyle.plan] ?? SubscriptionStyle.plan.free;
  const label = SubscriptionPlan.label[plan as keyof typeof SubscriptionPlan.label] ?? plan;
  return (
    <Chip
      label={label}
      size="small"
      sx={{ background: s.bg, color: s.color, fontWeight: 700, fontSize: '0.75rem' }}
    />
  );
}

function StatusChip({ status }: { status: string }) {
  const s = SubscriptionStyle.status[status as keyof typeof SubscriptionStyle.status] ?? SubscriptionStyle.status.active;
  const labels: Record<string, string> = {
    active: 'Active',
    cancelled: 'Cancelled',
    expired: 'Expired',
    enterprise_pending: 'Pending',
  };
  return (
    <Chip
      label={labels[status] ?? status}
      size="small"
      sx={{ background: s.bg, color: s.color, fontWeight: 700, fontSize: '0.75rem' }}
    />
  );
}

function OrgSubscriptionsTab() {
  const navigate = useNavigate();
  const { data: subs, isLoading, error } = useQuery({
    queryKey: ['subscriptions', 'orgs'],
    queryFn: subscriptionsApi.listOrgs,
  });

  if (isLoading) return <Skeleton height={300} />;
  if (error) return <Alert severity="error">Failed to load org subscriptions</Alert>;

  return (
    <Box>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700 }}>Organization</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Plan</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Seats</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Renewal</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {subs?.map((sub: OrgSubscription) => {
            const seatPct =
              sub.seat_limit === -1
                ? 0
                : Math.min(100, (sub.seat_used / sub.seat_limit) * 100);
            return (
              <TableRow
                key={sub.id}
                hover
                sx={{ cursor: 'pointer' }}
                onClick={() => navigate(`/app/subscriptions/orgs/${sub.org}`)}
              >
                <TableCell>
                  <Typography fontWeight={600}>{sub.org_name}</Typography>
                </TableCell>
                <TableCell>
                  <PlanChip plan={sub.plan} />
                </TableCell>
                <TableCell>
                  <StatusChip status={sub.status} />
                </TableCell>
                <TableCell sx={{ minWidth: 140 }}>
                  {sub.seat_limit === -1 ? (
                    <Typography variant="body2" color="text.secondary">
                      {sub.seat_used} / ∞
                    </Typography>
                  ) : (
                    <Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                        {sub.seat_used} / {sub.seat_limit}
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={seatPct}
                        sx={{
                          height: 6,
                          borderRadius: 3,
                          bgcolor: '#F1F5F9',
                          '& .MuiLinearProgress-bar': {
                            bgcolor: seatPct >= 90 ? '#EF4444' : '#F97316',
                            borderRadius: 3,
                          },
                        }}
                      />
                    </Box>
                  )}
                </TableCell>
                <TableCell>
                  {sub.current_period_end ? (
                    <Typography variant="body2" color="text.secondary">
                      {new Date(sub.current_period_end).toLocaleDateString()}
                    </Typography>
                  ) : (
                    <Typography variant="body2" color="text.disabled">—</Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    size="small"
                    sx={{ borderRadius: 50, fontSize: '0.75rem' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/app/subscriptions/orgs/${sub.org}`);
                    }}
                  >
                    Manage
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
          {!subs?.length && (
            <TableRow>
              <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                No org subscriptions found
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Box>
  );
}

function StudentSubscriptionsTab() {
  const { data: subs, isLoading, error } = useQuery({
    queryKey: ['subscriptions', 'students'],
    queryFn: subscriptionsApi.listStudents,
  });

  if (isLoading) return <Skeleton height={300} />;
  if (error) return <Alert severity="error">Failed to load student subscriptions</Alert>;

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell sx={{ fontWeight: 700 }}>Student</TableCell>
          <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
          <TableCell sx={{ fontWeight: 700 }}>Kind</TableCell>
          <TableCell sx={{ fontWeight: 700 }}>Plan</TableCell>
          <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
          <TableCell sx={{ fontWeight: 700 }}>Renewal</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {subs?.map((sub: StudentSubscription) => (
          <TableRow key={sub.id}>
            <TableCell>
              <Typography fontWeight={600}>{sub.user_name}</Typography>
            </TableCell>
            <TableCell>
              <Typography variant="body2" color="text.secondary">{sub.user_email}</Typography>
            </TableCell>
            <TableCell>
              <Chip
                label={sub.kind === 'individual' ? 'Individual' : 'Org covered'}
                size="small"
                sx={{
                  background: sub.kind === 'individual' ? '#DBEAFE' : '#D1FAE5',
                  color: sub.kind === 'individual' ? '#1E40AF' : '#065F46',
                  fontWeight: 600,
                  fontSize: '0.72rem',
                }}
              />
            </TableCell>
            <TableCell>
              <PlanChip plan={sub.plan} />
            </TableCell>
            <TableCell>
              <StatusChip status={sub.status} />
            </TableCell>
            <TableCell>
              {sub.current_period_end ? (
                <Typography variant="body2" color="text.secondary">
                  {new Date(sub.current_period_end).toLocaleDateString()}
                </Typography>
              ) : (
                <Typography variant="body2" color="text.disabled">—</Typography>
              )}
            </TableCell>
          </TableRow>
        ))}
        {!subs?.length && (
          <TableRow>
            <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
              No student subscriptions found
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

export default function Subscriptions() {
  const [tab, setTab] = useState(0);
  useAuthStore();

  // Summary counts for header cards
  const { data: orgSubs } = useQuery({
    queryKey: ['subscriptions', 'orgs'],
    queryFn: subscriptionsApi.listOrgs,
  });

  const proCount = orgSubs?.filter((s) => s.plan === 'pro' && s.status === 'active').length ?? 0;
  const enterpriseCount =
    orgSubs?.filter((s) => s.plan === 'enterprise' && s.status === 'active').length ?? 0;
  const pendingCount = orgSubs?.filter((s) => s.status === 'enterprise_pending').length ?? 0;

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 1 }}>Subscriptions</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Manage organization and student subscriptions
      </Typography>

      {/* Summary cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 2, mb: 3 }}>
        {[
          { label: 'Pro Orgs', value: proCount, bg: '#DBEAFE', color: '#1E40AF' },
          { label: 'Enterprise', value: enterpriseCount, bg: '#EDE9FE', color: '#5B21B6' },
          { label: 'Pending Enterprise', value: pendingCount, bg: '#FEF3C7', color: '#92400E' },
        ].map((card) => (
          <Box
            key={card.label}
            sx={{
              p: 2.5,
              borderRadius: 3,
              background: card.bg,
              border: `1.5px solid ${card.color}22`,
            }}
          >
            <Typography variant="h4" sx={{ color: card.color, fontWeight: 800, lineHeight: 1 }}>
              {card.value}
            </Typography>
            <Typography variant="caption" sx={{ color: card.color, fontWeight: 600 }}>
              {card.label}
            </Typography>
          </Box>
        ))}
      </Box>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ mb: 2, borderBottom: '1px solid', borderColor: 'divider' }}
      >
        <Tab label="Organizations" />
        <Tab label="Students" />
      </Tabs>

      {tab === 0 && <OrgSubscriptionsTab />}
      {tab === 1 && <StudentSubscriptionsTab />}
    </Box>
  );
}
