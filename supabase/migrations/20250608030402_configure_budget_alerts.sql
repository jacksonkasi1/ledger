-- This migration sets up the database configuration for budget alerts
-- You'll need to replace the placeholder values with your actual Supabase project details

-- Set up configuration for the trigger function
-- IMPORTANT: Replace these with your actual values before running the migration
DO $$
BEGIN
  -- Set Supabase URL (replace with your project URL)
  PERFORM set_config('app.settings.supabase_url', 'https://your-project-id.supabase.co', false);
  
  -- Set Supabase Anon Key (replace with your anon key from your Supabase dashboard)
  PERFORM set_config('app.settings.supabase_anon_key', 'your_supabase_anon_key_here', false);
END
$$;

-- Alternative approach: Create a simpler trigger that logs to a table for processing
-- This can be used if the HTTP approach has issues

CREATE TABLE IF NOT EXISTS budget_alert_queue (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed BOOLEAN DEFAULT FALSE
);

-- Create an index for faster processing
CREATE INDEX IF NOT EXISTS idx_budget_alert_queue_unprocessed 
ON budget_alert_queue(processed, created_at) 
WHERE processed = FALSE;

-- Alternative trigger function that queues alerts instead of making HTTP calls
CREATE OR REPLACE FUNCTION queue_budget_alert_check()
RETURNS trigger AS $$
BEGIN
  -- Insert into queue for later processing
  INSERT INTO budget_alert_queue (user_id) 
  VALUES (COALESCE(NEW.user_id, OLD.user_id))
  ON CONFLICT DO NOTHING;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE budget_alert_queue IS 'Queue table for budget alert checks that need processing';
COMMENT ON FUNCTION queue_budget_alert_check() IS 'Alternative trigger function that queues budget alert checks for batch processing';
