-- 0030_blood_fulfillment_orchestration.sql
-- Unifies bank fulfillment and donor commitments without treating commitments as
-- delivered blood. All clinical fulfillment remains server-authorized and atomic.

ALTER TYPE public.blood_broadcast_response_status
  ADD VALUE IF NOT EXISTS 'released';

ALTER TABLE public.blood_broadcast_responses
  ADD COLUMN IF NOT EXISTS units int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS fulfilled_at timestamptz,
  ADD COLUMN IF NOT EXISTS released_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'blood_broadcast_responses_units_check'
  ) THEN
    ALTER TABLE public.blood_broadcast_responses
      ADD CONSTRAINT blood_broadcast_responses_units_check CHECK (units > 0);
  END IF;
END $$;

ALTER TABLE public.blood_donations
  ADD COLUMN IF NOT EXISTS broadcast_response_id uuid
    REFERENCES public.blood_broadcast_responses(id);

CREATE UNIQUE INDEX IF NOT EXISTS blood_donations_broadcast_response_idx
  ON public.blood_donations(broadcast_response_id)
  WHERE broadcast_response_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS blood_broadcast_responses_request_confirmed_idx
  ON public.blood_broadcast_responses(request_id, status, confirmed_at);


