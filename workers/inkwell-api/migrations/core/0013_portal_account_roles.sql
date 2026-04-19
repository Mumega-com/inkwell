-- Add role column to portal_accounts
-- First account per customer_slug gets 'owner', subsequent accounts get 'member'
ALTER TABLE portal_accounts ADD COLUMN role TEXT NOT NULL DEFAULT 'member';
