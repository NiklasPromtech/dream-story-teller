
CREATE TABLE public.story_episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  episode_number integer NOT NULL DEFAULT 1,
  session_name text,
  summary text,
  characters jsonb DEFAULT '[]'::jsonb,
  transcript text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.story_episodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read episodes"
ON public.story_episodes FOR SELECT
USING (true);

CREATE POLICY "Allow public insert episodes"
ON public.story_episodes FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow public update episodes"
ON public.story_episodes FOR UPDATE
USING (true);
