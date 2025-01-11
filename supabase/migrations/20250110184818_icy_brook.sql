-- Function to update partner total
CREATE OR REPLACE FUNCTION update_partner_total(p_partner_id uuid, p_amount decimal)
RETURNS void AS $$
BEGIN
  UPDATE partners
  SET total = total + p_amount
  WHERE id = p_partner_id;
END;
$$ LANGUAGE plpgsql;