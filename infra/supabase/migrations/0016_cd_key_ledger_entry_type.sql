-- Keep CD-Key credits distinguishable from paid orders, signup gifts, and
-- manual operator adjustments in the immutable ledger.
alter type public.ledger_entry_type add value if not exists 'cd_key_redemption';
