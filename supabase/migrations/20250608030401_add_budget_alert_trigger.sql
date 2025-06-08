-- Enable the http extension if not already enabled
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- Create or replace the trigger function that will check budget alerts
CREATE OR REPLACE FUNCTION check_budget_alerts_trigger()
RETURNS trigger AS $$
DECLARE
  supabase_url text;
  supabase_anon_key text;
  user_id_to_check uuid;
BEGIN
  -- Get the user_id from the affected row
  user_id_to_check := COALESCE(NEW.user_id, OLD.user_id);

  -- Skip if no user_id (shouldn't happen but safety check)
  IF user_id_to_check IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Get Supabase configuration from environment
  supabase_url := current_setting('app.settings.supabase_url', true);
  supabase_anon_key := current_setting('app.settings.supabase_anon_key', true);
  
  -- If settings are not available, use default approach (will need to be configured)
  IF supabase_url IS NULL THEN
    supabase_url := 'https://your-project-id.supabase.co';
  END IF;
  
  IF supabase_anon_key IS NULL THEN
    supabase_anon_key := 'your_supabase_anon_key_here';
  END IF;

  -- Call the budget alerts function asynchronously
  -- This runs in the background and won't block the expense operation
  BEGIN
    PERFORM http_post(
      supabase_url || '/functions/v1/send-budget-alerts',
      jsonb_build_object('user_id', user_id_to_check),
      'application/json',
      jsonb_build_object(
        'Authorization', 'Bearer ' || supabase_anon_key,
        'Content-Type', 'application/json'
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- Log the error but don't fail the transaction
    RAISE NOTICE 'Failed to trigger budget alerts: %', SQLERRM;
  END;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger on the expenses table
DROP TRIGGER IF EXISTS expenses_budget_alert_trigger ON expenses;

CREATE TRIGGER expenses_budget_alert_trigger
  AFTER INSERT OR UPDATE OR DELETE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION check_budget_alerts_trigger();

-- Add a comment explaining the trigger
COMMENT ON TRIGGER expenses_budget_alert_trigger ON expenses IS 
'Automatically checks budget alerts when expenses are added, updated, or deleted';

COMMENT ON FUNCTION check_budget_alerts_trigger() IS 
'Trigger function that calls the send-budget-alerts Supabase function when expenses change';
