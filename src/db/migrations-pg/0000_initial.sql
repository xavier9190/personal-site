CREATE TABLE "calendar_events" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"start_at" text NOT NULL,
	"end_at" text NOT NULL,
	"all_day" boolean DEFAULT false NOT NULL,
	"color" text NOT NULL,
	"recurrence_rule" text DEFAULT 'NONE' NOT NULL,
	"recurrence_until" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_cards" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"closing_day" integer NOT NULL,
	"due_day" integer NOT NULL,
	"limit_cents" integer
);
--> statement-breakpoint
CREATE TABLE "shopping_items" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"price_cents" integer NOT NULL,
	"product_url" text,
	"status" text NOT NULL,
	"store_app" text,
	"tracking_url" text,
	"purchased_at" text,
	"estimated_delivery_date" text,
	"delivered_at" text
);
--> statement-breakpoint
CREATE TABLE "installment_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"total_installments" integer NOT NULL,
	"paid_installments" integer DEFAULT 0 NOT NULL,
	"installment_amount_cents" integer NOT NULL,
	"credit_card_id" text,
	"start_month" text NOT NULL,
	"shopping_item_id" text,
	CONSTRAINT "installment_plans_credit_card_id_credit_cards_id_fk" FOREIGN KEY ("credit_card_id") REFERENCES "public"."credit_cards"("id") ON DELETE set null ON UPDATE no action,
	CONSTRAINT "installment_plans_shopping_item_id_shopping_items_id_fk" FOREIGN KEY ("shopping_item_id") REFERENCES "public"."shopping_items"("id") ON DELETE set null ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE "payable_bills" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"bill_type" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"category" text NOT NULL,
	"due_date" text NOT NULL,
	"competence_month" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"paid_at" text,
	"credit_card_id" text,
	CONSTRAINT "payable_bills_credit_card_id_credit_cards_id_fk" FOREIGN KEY ("credit_card_id") REFERENCES "public"."credit_cards"("id") ON DELETE set null ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"occurred_at" text NOT NULL,
	"status" text DEFAULT 'PAID' NOT NULL,
	"payable_bill_id" text,
	"shopping_item_id" text,
	CONSTRAINT "transactions_payable_bill_id_payable_bills_id_fk" FOREIGN KEY ("payable_bill_id") REFERENCES "public"."payable_bills"("id") ON DELETE set null ON UPDATE no action,
	CONSTRAINT "transactions_shopping_item_id_shopping_items_id_fk" FOREIGN KEY ("shopping_item_id") REFERENCES "public"."shopping_items"("id") ON DELETE set null ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE "finance_preferences" (
	"id" text PRIMARY KEY NOT NULL,
	"hide_balance" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "academic_projects" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"final_delivery_date" text,
	"group_members" text DEFAULT '[]' NOT NULL,
	"status" text DEFAULT 'IN_PROGRESS' NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_milestones" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"title" text NOT NULL,
	"due_date" text NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "project_milestones_project_id_academic_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."academic_projects"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE "project_links" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"label" text NOT NULL,
	"url" text NOT NULL,
	CONSTRAINT "project_links_project_id_academic_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."academic_projects"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE "chat_threads" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"thread_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"attachments_json" text DEFAULT '[]' NOT NULL,
	"tool_calls_json" text DEFAULT '[]' NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "chat_messages_thread_id_chat_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."chat_threads"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE "pending_tool_actions" (
	"id" text PRIMARY KEY NOT NULL,
	"thread_id" text NOT NULL,
	"tool_name" text NOT NULL,
	"args_json" text NOT NULL,
	"status" text NOT NULL,
	"undo_snapshot_json" text,
	CONSTRAINT "pending_tool_actions_thread_id_chat_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."chat_threads"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
ALTER TABLE "calendar_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "credit_cards" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "installment_plans" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "payable_bills" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "transactions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "finance_preferences" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "academic_projects" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "project_milestones" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "project_links" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "shopping_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "chat_threads" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "chat_messages" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "pending_tool_actions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
		AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
		REVOKE ALL ON TABLE "calendar_events" FROM anon, authenticated;
		REVOKE ALL ON TABLE "credit_cards" FROM anon, authenticated;
		REVOKE ALL ON TABLE "installment_plans" FROM anon, authenticated;
		REVOKE ALL ON TABLE "payable_bills" FROM anon, authenticated;
		REVOKE ALL ON TABLE "transactions" FROM anon, authenticated;
		REVOKE ALL ON TABLE "finance_preferences" FROM anon, authenticated;
		REVOKE ALL ON TABLE "academic_projects" FROM anon, authenticated;
		REVOKE ALL ON TABLE "project_milestones" FROM anon, authenticated;
		REVOKE ALL ON TABLE "project_links" FROM anon, authenticated;
		REVOKE ALL ON TABLE "shopping_items" FROM anon, authenticated;
		REVOKE ALL ON TABLE "chat_threads" FROM anon, authenticated;
		REVOKE ALL ON TABLE "chat_messages" FROM anon, authenticated;
		REVOKE ALL ON TABLE "pending_tool_actions" FROM anon, authenticated;
	END IF;
END
$$;
