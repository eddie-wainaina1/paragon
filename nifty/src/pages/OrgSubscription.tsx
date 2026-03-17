import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
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
  TextField,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subscriptionsApi } from '@/api/subscriptions';
import { useAuthStore } from '@/store/authStore';
import { Role, SubscriptionPlan, SubscriptionStyle } from '@/constants';

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
    enterprise_pending: 'Pending Approval',
  };
  return (
    <Chip
      label={labels[status] ?? status}
      sx={{ background: s.bg, color: s.color, fontWeight: 700, fontSize: '0.85rem', px: 0.5 }}
    />
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box>
      <Typography
        variant="caption"
        color="text.secondary"
        fontWeight={700}
        sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}
      >
        {label}
      </Typography>
      <Box sx={{ mt: 0.25 }}>{value}</Box>
    </Box>
  );
}

export default function OrgSubscription() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthStore();
  const isFinanceAdmin =
    currentUser?.role === Role.super_admin || currentUser?.role === Role.finance;
  const isOrgAdmin = currentUser?.role === Role.org_admin;

  const [searchParams, setSearchParams] = useSearchParams();
  const [verifying, setVerifying] = useState(false);
  const [enterpriseDialog, setEnterpriseDialog] = useState(false);
  const [enterpriseNote, setEnterpriseNote] = useState('');
  const [cancelDialog, setCancelDialog] = useState(false);
  const [manualDialog, setManualDialog] = useState(false);
  const [manualPlan, setManualPlan] = useState('');
  const [manualStatus, setManualStatus] = useState('');
  const [manualSeatLimit, setManualSeatLimit] = useState('');
  const [manualNote, setManualNote] = useState('');
  const [error, setError] = useState('');

  const reference = searchParams.get('reference');

  // Auto-verify if returning from Paystack checkout
  useEffect(() => {
    if (reference && orgId && !verifying) {
      setVerifying(true);
      subscriptionsApi
        .verifyOrgUpgrade(orgId, reference)
        .then(() => {
          invalidate();
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
  }, [reference, orgId]);

  const { data: sub, isLoading } = useQuery({
    queryKey: ['subscriptions', 'orgs', orgId],
    queryFn: () => subscriptionsApi.getOrg(orgId!),
    enabled: !!orgId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['subscriptions', 'orgs', orgId] });
    queryClient.invalidateQueries({ queryKey: ['subscriptions', 'orgs'] });
  };

  const upgradeMutation = useMutation({
    mutationFn: () =>
      subscriptionsApi.upgradeOrg(orgId!, {
        billing_cycle: 'monthly',
        callback_url: `${window.location.origin}/app/subscriptions/orgs/${orgId}?verify=1`,
      }),
    onSuccess: (data) => {
      // Redirect to Paystack checkout
      window.location.href = data.authorization_url;
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Failed to initiate payment';
      setError(msg);
    },
  });

  const enterpriseMutation = useMutation({
    mutationFn: () =>
      subscriptionsApi.applyEnterprise(orgId!, { note: enterpriseNote }),
    onSuccess: () => {
      setEnterpriseDialog(false);
      setEnterpriseNote('');
      invalidate();
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Failed to submit application';
      setError(msg);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => subscriptionsApi.cancelOrg(orgId!),
    onSuccess: () => {
      setCancelDialog(false);
      invalidate();
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Failed to cancel subscription';
      setError(msg);
    },
  });

  const manualMutation = useMutation({
    mutationFn: () =>
      subscriptionsApi.updateOrg(orgId!, {
        ...(manualPlan && { plan: manualPlan }),
        ...(manualStatus && { status: manualStatus }),
        ...(manualSeatLimit && { seat_limit: parseInt(manualSeatLimit, 10) }),
        ...(manualNote && { note: manualNote }),
      }),
    onSuccess: () => {
      setManualDialog(false);
      invalidate();
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Update failed';
      setError(msg);
    },
  });

  function openManualDialog() {
    if (!sub) return;
    setManualPlan(sub.plan);
    setManualStatus(sub.status);
    setManualSeatLimit(sub.seat_limit === -1 ? '-1' : String(sub.seat_limit));
    setManualNote(sub.enterprise_note ?? '');
    setManualDialog(true);
  }

  if (isLoading) {
    return (
      <Box>
        <Skeleton width={200} height={36} sx={{ mb: 3 }} />
        <Skeleton height={300} />
      </Box>
    );
  }

  if (!sub) {
    return (
      <Box>
        <Button onClick={() => navigate(-1)} sx={{ mb: 2 }}>← Back</Button>
        <Alert severity="error">Subscription not found</Alert>
      </Box>
    );
  }

  const seatPct =
    sub.seat_limit === -1 ? 0 : Math.min(100, (sub.seat_used / sub.seat_limit) * 100);
  const canUpgrade =
    sub.plan === 'free' && sub.status !== 'enterprise_pending';
  const canApplyEnterprise =
    sub.plan !== 'enterprise' && sub.status !== 'enterprise_pending';
  const canCancel =
    sub.plan !== 'free' &&
    sub.status !== 'cancelled' &&
    (isFinanceAdmin || (isOrgAdmin && sub.plan !== 'enterprise'));

  return (
    <Box>
      <Button onClick={() => navigate(-1)} sx={{ mb: 3, borderRadius: 50 }}>
        ← Back
      </Button>

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4">{sub.org_name}</Typography>
          <Typography color="text.secondary" variant="body2">Subscription management</Typography>
        </Box>
        <PlanChip plan={sub.plan} />
        <StatusChip status={sub.status} />
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {sub.status === 'enterprise_pending' && (
        <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
          Enterprise application submitted — our team will reach out shortly.
        </Alert>
      )}

      {/* Details card */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h5" sx={{ mb: 2 }}>Details</Typography>
          <Divider sx={{ mb: 2 }} />
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 2.5 }}>
            <DetailRow label="Plan" value={<PlanChip plan={sub.plan} />} />
            <DetailRow label="Status" value={<StatusChip status={sub.status} />} />
            <DetailRow
              label="Billing"
              value={
                <Typography>
                  {sub.billing_cycle
                    ? `${sub.billing_cycle.charAt(0).toUpperCase()}${sub.billing_cycle.slice(1)}`
                    : '—'}
                </Typography>
              }
            />
            <DetailRow
              label="Renewal Date"
              value={
                <Typography>
                  {sub.current_period_end
                    ? new Date(sub.current_period_end).toLocaleDateString()
                    : '—'}
                </Typography>
              }
            />
          </Box>
        </CardContent>
      </Card>

      {/* Seat usage card */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h5" sx={{ mb: 2 }}>Seat Usage</Typography>
          <Divider sx={{ mb: 2 }} />
          {sub.seat_limit === -1 ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h3" fontWeight={800}>{sub.seat_used}</Typography>
              <Typography color="text.secondary">students / unlimited seats</Typography>
            </Box>
          ) : (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography fontWeight={600}>
                  {sub.seat_used} / {sub.seat_limit} seats used
                </Typography>
                <Typography color="text.secondary">{Math.round(seatPct)}%</Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={seatPct}
                sx={{
                  height: 10,
                  borderRadius: 5,
                  bgcolor: '#F1F5F9',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: seatPct >= 90 ? '#EF4444' : '#F97316',
                    borderRadius: 5,
                  },
                }}
              />
              {seatPct >= 90 && (
                <Alert severity="warning" sx={{ mt: 1.5, borderRadius: 2 }}>
                  Approaching seat limit. Consider upgrading your plan.
                </Alert>
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Actions card */}
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h5" sx={{ mb: 2 }}>Actions</Typography>
          <Divider sx={{ mb: 2 }} />
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            {canUpgrade && (
              <Button
                variant="contained"
                sx={{ borderRadius: 50 }}
                onClick={() => upgradeMutation.mutate()}
                disabled={upgradeMutation.isPending}
              >
                Upgrade to Pro — KES 14,999/mo
              </Button>
            )}
            {canApplyEnterprise && (
              <Button
                variant="outlined"
                sx={{ borderRadius: 50 }}
                onClick={() => setEnterpriseDialog(true)}
              >
                Apply for Enterprise
              </Button>
            )}
            {canCancel && (
              <Button
                variant="outlined"
                color="error"
                sx={{ borderRadius: 50 }}
                onClick={() => setCancelDialog(true)}
              >
                Cancel Subscription
              </Button>
            )}
            {isFinanceAdmin && (
              <Button
                variant="outlined"
                sx={{ borderRadius: 50, ml: 'auto' }}
                onClick={openManualDialog}
              >
                Manual Override
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Enterprise application dialog */}
      <Dialog open={enterpriseDialog} onClose={() => setEnterpriseDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Apply for Enterprise</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Tell us about your organization's needs. Our team will reach out to tailor a plan
            for you (unlimited students, custom support).
          </Typography>
          <TextField
            label="Tell us about your needs (optional)"
            multiline
            rows={4}
            fullWidth
            value={enterpriseNote}
            onChange={(e) => setEnterpriseNote(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEnterpriseDialog(false)} sx={{ borderRadius: 50 }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            sx={{ borderRadius: 50 }}
            onClick={() => enterpriseMutation.mutate()}
            disabled={enterpriseMutation.isPending}
          >
            Submit Application
          </Button>
        </DialogActions>
      </Dialog>

      {/* Cancel confirmation dialog */}
      <Dialog open={cancelDialog} onClose={() => setCancelDialog(false)}>
        <DialogTitle>Cancel Subscription?</DialogTitle>
        <DialogContent>
          <Typography>
            This will cancel your current plan. Your organization will revert to the Free tier
            (50 seats) at the end of the billing period.
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

      {/* Manual override dialog (Finance/SuperAdmin) */}
      <Dialog open={manualDialog} onClose={() => setManualDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Manual Subscription Override</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Plan</InputLabel>
              <Select value={manualPlan} label="Plan" onChange={(e) => setManualPlan(e.target.value)}>
                <MenuItem value="free">Free</MenuItem>
                <MenuItem value="pro">Pro</MenuItem>
                <MenuItem value="enterprise">Enterprise</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select value={manualStatus} label="Status" onChange={(e) => setManualStatus(e.target.value)}>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
                <MenuItem value="expired">Expired</MenuItem>
                <MenuItem value="enterprise_pending">Enterprise Pending</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Seat Limit (-1 for unlimited)"
              type="number"
              value={manualSeatLimit}
              onChange={(e) => setManualSeatLimit(e.target.value)}
            />
            <TextField
              label="Internal note"
              multiline
              rows={2}
              value={manualNote}
              onChange={(e) => setManualNote(e.target.value)}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setManualDialog(false)} sx={{ borderRadius: 50 }}>Cancel</Button>
          <Button
            variant="contained"
            sx={{ borderRadius: 50 }}
            onClick={() => manualMutation.mutate()}
            disabled={manualMutation.isPending}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
