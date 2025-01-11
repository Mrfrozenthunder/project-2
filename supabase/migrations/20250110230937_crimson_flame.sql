/*
  # Fix partner total update function

  1. Changes
    - Modify update_partner_total function to properly handle decimal values
    - Add error handling and validation
    - Add transaction safety

  2. Security
    - Function remains accessible only to authenticated users through RLS
*/

CREATE OR REPLACE FUNCTION update_partner_total(p_partner_id uuid, p_amount decimal)
RETURNS void AS $$
BEGIN
  -- Validate input
  IF p_partner_id IS NULL THEN
    RAISE EXCEPTION 'Partner ID cannot be null';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than 0';
  END IF;

  -- Update partner total with explicit decimal handling
  UPDATE partners
  SET total = COALESCE(total, 0) + p_amount::decimal
  WHERE id = p_partner_id;

  -- Check if update was successful
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Partner not found';
  END IF;
END;
$$ LANGUAGE plpgsql;