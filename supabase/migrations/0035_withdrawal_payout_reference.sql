-- Référence de la transaction Mobile Money saisie par l'admin quand il marque un retrait « envoyé ».
-- Preuve en cas de litige. Les anciennes lignes restent à NULL.
alter table public.wallet_transactions
  add column if not exists payout_reference text;
