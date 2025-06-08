

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "http" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."check_budget_alerts_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."check_budget_alerts_trigger"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_budget_alerts_trigger"() IS 'Trigger function that calls the send-budget-alerts Supabase function when expenses change';



CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name'
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."queue_budget_alert_check"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Insert into queue for later processing
  INSERT INTO budget_alert_queue (user_id) 
  VALUES (COALESCE(NEW.user_id, OLD.user_id))
  ON CONFLICT DO NOTHING;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."queue_budget_alert_check"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."queue_budget_alert_check"() IS 'Alternative trigger function that queues budget alert checks for batch processing';



CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."budget_alert_queue" (
    "id" integer NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "processed" boolean DEFAULT false
);


ALTER TABLE "public"."budget_alert_queue" OWNER TO "postgres";


COMMENT ON TABLE "public"."budget_alert_queue" IS 'Queue table for budget alert checks that need processing';



CREATE SEQUENCE IF NOT EXISTS "public"."budget_alert_queue_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."budget_alert_queue_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."budget_alert_queue_id_seq" OWNED BY "public"."budget_alert_queue"."id";



CREATE TABLE IF NOT EXISTS "public"."budget_alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "category_id" "uuid",
    "amount_limit" numeric(10,2) NOT NULL,
    "period" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "budget_alerts_period_check" CHECK (("period" = ANY (ARRAY['weekly'::"text", 'monthly'::"text", 'yearly'::"text"])))
);


ALTER TABLE "public"."budget_alerts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "color" "text" NOT NULL,
    "icon" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."expense_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "expense_id" "uuid" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_path" "text" NOT NULL,
    "file_type" "text",
    "file_size" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."expense_attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."expenses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "description" "text" NOT NULL,
    "category_id" "uuid",
    "vendor" "text" NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "receipt_email" "text",
    "raw_email_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."expenses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "email" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "avatar_url" "text"
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


ALTER TABLE ONLY "public"."budget_alert_queue" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."budget_alert_queue_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."budget_alert_queue"
    ADD CONSTRAINT "budget_alert_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."budget_alerts"
    ADD CONSTRAINT "budget_alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expense_attachments"
    ADD CONSTRAINT "expense_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_user_id_key" UNIQUE ("user_id");



CREATE INDEX "idx_budget_alert_queue_unprocessed" ON "public"."budget_alert_queue" USING "btree" ("processed", "created_at") WHERE ("processed" = false);



CREATE OR REPLACE TRIGGER "expenses_budget_alert_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."expenses" FOR EACH ROW EXECUTE FUNCTION "public"."check_budget_alerts_trigger"();



COMMENT ON TRIGGER "expenses_budget_alert_trigger" ON "public"."expenses" IS 'Automatically checks budget alerts when expenses are added, updated, or deleted';



CREATE OR REPLACE TRIGGER "update_budget_alerts_updated_at" BEFORE UPDATE ON "public"."budget_alerts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_expenses_updated_at" BEFORE UPDATE ON "public"."expenses" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_profiles_updated_at" BEFORE UPDATE ON "public"."user_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."budget_alerts"
    ADD CONSTRAINT "budget_alerts_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id");



ALTER TABLE ONLY "public"."budget_alerts"
    ADD CONSTRAINT "budget_alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."expense_attachments"
    ADD CONSTRAINT "expense_attachments_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id");



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



CREATE POLICY "Authenticated users can view categories" ON "public"."categories" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can create their own budget alerts" ON "public"."budget_alerts" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own budget alerts" ON "public"."budget_alerts" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own expenses" ON "public"."expenses" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert attachments for their expenses" ON "public"."expense_attachments" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."expenses"
  WHERE (("expenses"."id" = "expense_attachments"."expense_id") AND ("expenses"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert their own budget alerts" ON "public"."budget_alerts" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own expenses" ON "public"."expenses" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own profile" ON "public"."user_profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own budget alerts" ON "public"."budget_alerts" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own expenses" ON "public"."expenses" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own profile" ON "public"."user_profiles" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view attachments for their expenses" ON "public"."expense_attachments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."expenses"
  WHERE (("expenses"."id" = "expense_attachments"."expense_id") AND ("expenses"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view their own budget alerts" ON "public"."budget_alerts" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own expenses" ON "public"."expenses" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own profile" ON "public"."user_profiles" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."budget_alerts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."expense_attachments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."expenses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";


















































































































































































































GRANT ALL ON FUNCTION "public"."check_budget_alerts_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_budget_alerts_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_budget_alerts_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."queue_budget_alert_check"() TO "anon";
GRANT ALL ON FUNCTION "public"."queue_budget_alert_check"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."queue_budget_alert_check"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


















GRANT ALL ON TABLE "public"."budget_alert_queue" TO "anon";
GRANT ALL ON TABLE "public"."budget_alert_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."budget_alert_queue" TO "service_role";



GRANT ALL ON SEQUENCE "public"."budget_alert_queue_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."budget_alert_queue_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."budget_alert_queue_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."budget_alerts" TO "anon";
GRANT ALL ON TABLE "public"."budget_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."budget_alerts" TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON TABLE "public"."expense_attachments" TO "anon";
GRANT ALL ON TABLE "public"."expense_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."expense_attachments" TO "service_role";



GRANT ALL ON TABLE "public"."expenses" TO "anon";
GRANT ALL ON TABLE "public"."expenses" TO "authenticated";
GRANT ALL ON TABLE "public"."expenses" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






























RESET ALL;
