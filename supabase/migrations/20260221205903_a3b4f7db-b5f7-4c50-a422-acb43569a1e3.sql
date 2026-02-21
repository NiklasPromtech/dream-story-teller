
-- Stories table to remember past bedtime stories
CREATE TABLE public.stories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  topic TEXT NOT NULL,
  length TEXT NOT NULL DEFAULT 'medium',
  episode_count INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_played_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- No auth yet, so allow public access
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON public.stories FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.stories FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.stories FOR UPDATE USING (true);
