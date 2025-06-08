# Budget Alerts Setup Guide

This guide explains how to set up the automatic budget alert system that triggers email notifications when users exceed their budget limits.

## Files Created

1. `migrations/20250608030401_add_budget_alert_trigger.sql` - Main trigger setup
2. `migrations/20250608030402_configure_budget_alerts.sql` - Configuration and alternative queue approach
3. `functions/send-budget-alerts/index.ts` - Updated to support user-specific checks

## Setup Steps

### 1. Apply Database Migrations

Run the migrations in order:

```bash
# Navigate to your project directory
cd your-project-directory

# Apply the migrations using Supabase CLI
supabase db push

# Or run them manually in your Supabase SQL editor:
# - Copy contents of 20250608030401_add_budget_alert_trigger.sql
# - Copy contents of 20250608030402_configure_budget_alerts.sql
```

### 2. Configure Environment Variables

Update the configuration migration with your actual values:

1. Open `supabase/migrations/20250608030402_configure_budget_alerts.sql`
2. Replace `https://your-project-id.supabase.co` with your actual project URL
3. Replace `your-anon-key-here` with your actual anon key from Supabase dashboard

### 3. Deploy Functions

Deploy the updated budget alerts function:

```bash
supabase functions deploy send-budget-alerts
supabase functions deploy send-budget-alert-email
```

### 4. Test the System

1. Add an expense that would exceed your budget
2. Check your email for budget alert notification
3. Monitor Supabase logs for any errors

## How It Works

### Automatic Trigger Flow

1. **User adds/updates/deletes an expense** → Triggers `check_budget_alerts_trigger()`
2. **Trigger function** → Calls `send-budget-alerts` function with user ID
3. **Budget checker** → Calculates current spending vs budget limits
4. **If over 80% threshold** → Calls `send-budget-alert-email` function
5. **Email service** → Sends notification via Postmark

### Current Spending Analysis

Based on your scenario:
- Total expenses: $137
- Budget alerts: $100 and $20
- $137 vs $100 = 137% (should trigger)
- $137 vs $20 = 685% (should definitely trigger)

Both should send emails since they exceed the 80% threshold.

## Troubleshooting

### Issue 1: Trigger Not Working

**Check:** Database trigger exists
```sql
SELECT * FROM information_schema.triggers 
WHERE trigger_name = 'expenses_budget_alert_trigger';
```

**Check:** Function exists
```sql
SELECT proname FROM pg_proc WHERE proname = 'check_budget_alerts_trigger';
```

### Issue 2: HTTP Extension Missing

If you get HTTP extension errors:
```sql
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;
```

### Issue 3: Configuration Not Set

Verify configuration:
```sql
SELECT current_setting('app.settings.supabase_url', true);
SELECT current_setting('app.settings.supabase_anon_key', true);
```

### Issue 4: Alternative Queue Approach

If HTTP triggers don't work, switch to the queue approach:

1. Drop the current trigger:
```sql
DROP TRIGGER expenses_budget_alert_trigger ON expenses;
```

2. Create the queue trigger:
```sql
CREATE TRIGGER expenses_budget_alert_queue_trigger
  AFTER INSERT OR UPDATE OR DELETE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION queue_budget_alert_check();
```

3. Process queue periodically with a cron job or manual calls

## Testing Commands

### Manual Test Budget Alerts
```bash
curl -X POST 'https://your-project.supabase.co/functions/v1/send-budget-alerts' \
  -H 'Authorization: Bearer your-anon-key' \
  -H 'Content-Type: application/json'
```

### Test Specific User
```bash
curl -X POST 'https://your-project.supabase.co/functions/v1/send-budget-alerts' \
  -H 'Authorization: Bearer your-anon-key' \
  -H 'Content-Type: application/json' \
  -d '{"user_id": "user-uuid-here"}'
```

## Monitoring

Check Supabase function logs:
1. Go to Supabase Dashboard
2. Navigate to Edge Functions
3. Click on `send-budget-alerts` function
4. Check the logs tab for execution details

## Environment Variables Required

Make sure these are set in your Supabase project:
- `POSTMARK_SERVER_TOKEN` - Your Postmark API token
- `FROM_EMAIL` - Email address for sending alerts (default: your_verified_email@yourdomain.com)
- `SUPABASE_URL` - Your project URL (auto-set)
- `SUPABASE_ANON_KEY` - Your anon key (auto-set)
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (auto-set)
