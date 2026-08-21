-- Keep signup credits auditable instead of disguising them as an admin adjustment.
alter type public.ledger_entry_type add value if not exists 'signup_bonus';
