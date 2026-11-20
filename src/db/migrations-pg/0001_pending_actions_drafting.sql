ALTER TABLE "pending_tool_actions" ADD COLUMN "missing_fields_json" text;
--> statement-breakpoint
CREATE UNIQUE INDEX "pending_tool_actions_one_draft_per_thread_idx" ON "pending_tool_actions" ("thread_id") WHERE "status" = 'DRAFTING';
