ALTER TYPE "public"."auth_event_type" ADD VALUE 'phone_change';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone_nonce" "bytea";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone_ciphertext" "bytea";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone_hmac" "bytea";--> statement-breakpoint
CREATE INDEX "users_phone_hmac_idx" ON "users" USING btree ("phone_hmac");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_phone_complete" CHECK (("users"."phone_nonce" IS NULL AND "users"."phone_ciphertext" IS NULL AND "users"."phone_hmac" IS NULL) OR (octet_length("users"."phone_nonce") = 12 AND octet_length("users"."phone_ciphertext") BETWEEN 17 AND 64 AND octet_length("users"."phone_hmac") = 32));