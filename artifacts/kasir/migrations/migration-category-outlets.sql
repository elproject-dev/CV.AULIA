ALTER TABLE categories ADD COLUMN IF NOT EXISTS allowed_outlets JSONB DEFAULT '["all"]'::jsonb;
