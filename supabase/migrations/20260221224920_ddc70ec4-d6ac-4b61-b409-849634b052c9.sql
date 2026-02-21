
CREATE POLICY "Allow public delete" ON public.stories FOR DELETE USING (true);
CREATE POLICY "Allow public delete episodes" ON public.story_episodes FOR DELETE USING (true);
