CREATE TABLE IF NOT EXISTS public.webinars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  host text NOT NULL,
  date_time timestamptz NOT NULL,
  duration integer NOT NULL CHECK (duration BETWEEN 1 AND 1440),
  registrants integer NOT NULL CHECK (registrants BETWEEN 0 AND 1000000),
  attendees integer NOT NULL CHECK (attendees BETWEEN 0 AND 1000000),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Older local schemas rejected legitimate historical attendance above registrations.
ALTER TABLE public.webinars DROP CONSTRAINT IF EXISTS webinars_check;
ALTER TABLE public.webinars DROP CONSTRAINT IF EXISTS webinars_attendees_check;
ALTER TABLE public.webinars ADD CONSTRAINT webinars_attendees_check CHECK (attendees BETWEEN 0 AND 1000000);

CREATE INDEX IF NOT EXISTS webinars_date_time_idx ON public.webinars (date_time DESC);
