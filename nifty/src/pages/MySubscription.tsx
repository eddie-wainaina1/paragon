import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Chip,
  Alert,
  Skeleton,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subscriptionsApi } from '@/api/subscriptions';
import { SubscriptionStyle, SubscriptionPlan } from '@/constants';

function PlanChip({ plan }: { plan: string }) {
  const s = SubscriptionStyle.plan[plan as keyof typeof SubscriptionStyle.plan] ?? SubscriptionStyle.plan.free;
  const label = SubscriptionPlan.label[plan as keyof typeof SubscriptionPlan.label] ?? plan;
  return (
    <Chip
      label={label}
      sx={{ background: s.bg, color: s.color, fontWeight: 700, fontSize: '0.85rem', px: 0.5 }}
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
      sx={{ background: s.bg, color: s.color, fontWeight: 700, fontSize: '0.85rem', px: 0.5 }}
    />
  );
}

export default function MySubscription() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [error, setError] = useState('');
  const [cancelDialog, setCancelDialog] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const { data: sub, isLoading } = useQuery({
    queryKey: ['subscriptions', 'students', 'me'],
    queryFn: subscriptionsApi.getMySubscription,
  });

  const reference = searchParams.get('reference');

  // Auto-verify if returning from Paystack checkout
  useEffect(() => {
    if (reference && !verifying) {
      setVerifying(true);
      subscriptionsApi
        .verifyStudentUpgrade(reference)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['subscriptions', 'students', 'me'] });
          setSearchParams({});
        })
        .catch((err) => {
          const msg =
            (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
            'Payment verification failed';
          setError(msg);
        })
        .finally(() => setVerifying(false));
    }
  }, [reference]);

  const upgradeMutation = useMutation({
    mutationFn: () =>
      subscriptionsApi.upgradeStudent({
        billing_cycle: 'monthly',
        callback_url: `${window.location.origin}/app/my-subscription`,
      }),
    onSuccess: (data) => {
      window.location.href = data.authorization_url;
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Failed to initiate payment';
      setError(msg);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: subscriptionsApi.cancelStudentSubscription,
    onSuccess: () => {
      setCancelDialog(false);
      queryClient.invalidateQueries({ queryKey: ['subscriptions', 'students', 'me'] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Failed to cancel subscription';
      setError(msg);
    },
  });

  if (isLoading || verifying) {
    return (
      <Box>
        <Skeleton width={200} height={36} sx={{ mb: 3 }} />
        <Skeleton height={250} />
      </Box>
    );
  }

  if (!sub) {
    return (
      <Box sx={{ maxWidth: 420 }}>
        <Typography variant="h4" sx={{ mb: 1 }}>Subscribe to Nifty</Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Get access to all global content across the platform
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        <Card sx={{ border: '2px solid #DBEAFE', background: '#F0F7FF' }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography fontWeight={700}>Pro</Typography>
              <PlanChip plan="pro" />
            </Box>
            <Typography variant="h4" fontWeight={800} sx={{ mb: 0.5 }}>KES 999</Typography>
            <Typography variant="caption" color="text.secondary">per month</Typography>
            <Divider sx={{ my: 2 }} />
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
              Access to all global content across the platform
            </Typography>
            <Button
              fullWidth
              variant="contained"
              sx={{ borderRadius: 50 }}
              onClick={() => upgradeMutation.mutate()}
              disabled={upgradeMutation.isPending}
            >
              Subscribe — KES 999/mo
            </Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

  const isOrgCovered = sub.kind === 'org_covered';
  const isProActive = sub.plan === 'pro' && sub.status === 'active';

  return (
    <Box sx={{ maxWidth: 640 }}>
      <Typography variant="h4" sx={{ mb: 1 }}>My Subscription</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Manage your content access plan
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Current plan card */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h5">Current Plan</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <PlanChip plan={sub.plan} />
              <StatusChip status={sub.status} />
            </Box>
          </Box>
          <Divider sx={{ mb: 2 }} />

          {isOrgCovered ? (
            <Alert severity="success" sx={{ borderRadius: 2 }}>
              Your access is covered by your organization's subscription. No action needed.
            </Alert>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={700}
                  sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Billing
                </Typography>
                <Typography>
                  {sub.billing_cycle
                    ? `${sub.billing_cycle.charAt(0).toUpperCase()}${sub.billing_cycle.slice(1)}`
                    : '—'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={700}
                  sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Next renewal
                </Typography>
                <Typography>
                  {sub.current_period_end
                    ? new Date(sub.current_period_end).toLocaleDateString()
                    : '—'}
                </Typography>
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Plan info (only for individual students) */}
      {!isOrgCovered && (
        <Card
          sx={{
            mb: 2,
            border: '2px solid #DBEAFE',
            background: '#F0F7FF',
          }}
        >
          <CardContent sx={{ p: 2.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography fontWeight={700}>Pro</Typography>
              <PlanChip plan="pro" />
            </Box>
            <Typography variant="h5" fontWeight={800} sx={{ mb: 0.5 }}>KES 999</Typography>
            <Typography variant="caption" color="text.secondary">per month</Typography>
            <Divider sx={{ my: 1.5 }} />
            <Typography variant="body2" color="text.secondary">
              Access to all global content across the platform
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Action buttons (individual only) */}
      {!isOrgCovered && (
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h5" sx={{ mb: 2 }}>Actions</Typography>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              {!isProActive && (
                <Button
                  variant="contained"
                  sx={{ borderRadius: 50 }}
                  onClick={() => upgradeMutation.mutate()}
                  disabled={upgradeMutation.isPending}
                >
                  Upgrade to Pro — KES 999/mo
                </Button>
              )}
              {isProActive && (
                <Button
                  variant="outlined"
                  color="error"
                  sx={{ borderRadius: 50 }}
                  onClick={() => setCancelDialog(true)}
                >
                  Cancel Subscription
                </Button>
              )}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Cancel confirmation */}
      <Dialog open={cancelDialog} onClose={() => setCancelDialog(false)}>
        <DialogTitle>Cancel Subscription?</DialogTitle>
        <DialogContent>
          <Typography>
            You will lose access to global content and revert to the Free plan.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCancelDialog(false)} sx={{ borderRadius: 50 }}>Keep Plan</Button>
          <Button
            variant="contained"
            color="error"
            sx={{ borderRadius: 50 }}
            onClick={() => cancelMutation.mutate()}
            disabled={cancelMutation.isPending}
          >
            Yes, Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
