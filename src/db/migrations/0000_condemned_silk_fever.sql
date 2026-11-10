CREATE TABLE `calendar_events` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`start_at` text NOT NULL,
	`end_at` text NOT NULL,
	`all_day` integer DEFAULT false NOT NULL,
	`color` text NOT NULL,
	`recurrence_rule` text DEFAULT 'NONE' NOT NULL,
	`recurrence_until` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `credit_cards` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`closing_day` integer NOT NULL,
	`due_day` integer NOT NULL,
	`limit_cents` integer
);
--> statement-breakpoint
CREATE TABLE `finance_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`hide_balance` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `installment_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`description` text NOT NULL,
	`category` text NOT NULL,
	`total_installments` integer NOT NULL,
	`paid_installments` integer DEFAULT 0 NOT NULL,
	`installment_amount_cents` integer NOT NULL,
	`credit_card_id` text,
	`start_month` text NOT NULL,
	`shopping_item_id` text,
	FOREIGN KEY (`credit_card_id`) REFERENCES `credit_cards`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`shopping_item_id`) REFERENCES `shopping_items`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `payable_bills` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`bill_type` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`category` text NOT NULL,
	`due_date` text NOT NULL,
	`competence_month` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`paid_at` text,
	`credit_card_id` text,
	FOREIGN KEY (`credit_card_id`) REFERENCES `credit_cards`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`description` text NOT NULL,
	`category` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`occurred_at` text NOT NULL,
	`status` text DEFAULT 'PAID' NOT NULL,
	`payable_bill_id` text,
	`shopping_item_id` text,
	FOREIGN KEY (`payable_bill_id`) REFERENCES `payable_bills`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`shopping_item_id`) REFERENCES `shopping_items`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `academic_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`final_delivery_date` text,
	`group_members` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'IN_PROGRESS' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `project_links` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`label` text NOT NULL,
	`url` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `academic_projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `project_milestones` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`title` text NOT NULL,
	`due_date` text NOT NULL,
	`is_completed` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `academic_projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `shopping_items` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`price_cents` integer NOT NULL,
	`product_url` text,
	`status` text NOT NULL,
	`store_app` text,
	`tracking_url` text,
	`purchased_at` text,
	`estimated_delivery_date` text,
	`delivered_at` text
);
--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`attachments_json` text DEFAULT '[]' NOT NULL,
	`tool_calls_json` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`thread_id`) REFERENCES `chat_threads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `chat_threads` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pending_tool_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`tool_name` text NOT NULL,
	`args_json` text NOT NULL,
	`status` text NOT NULL,
	`undo_snapshot_json` text,
	FOREIGN KEY (`thread_id`) REFERENCES `chat_threads`(`id`) ON UPDATE no action ON DELETE cascade
);
