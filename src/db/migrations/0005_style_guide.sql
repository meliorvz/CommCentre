-- T-039: Add style guide columns to company_profile
-- Learn communication style from sent emails

ALTER TABLE company_profile
ADD COLUMN IF NOT EXISTS style_guide TEXT,
ADD COLUMN IF NOT EXISTS style_guide_updated_at TIMESTAMPTZ;

-- Add comment for documentation
COMMENT ON COLUMN company_profile.style_guide IS 'Learned communication style guide from sent emails (T-039)';
COMMENT ON COLUMN company_profile.style_guide_updated_at IS 'When the style guide was last updated';
