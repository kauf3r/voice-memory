-- Open Loops table for tracking decisions and waiting-for items from voice notes
-- Part of Voice Memory V2 ADHD analysis feature

CREATE TABLE open_loops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID REFERENCES notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('decision', 'waiting_for')),
  description TEXT NOT NULL,
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_open_loops_user_unresolved ON open_loops(user_id) WHERE resolved = FALSE;

ALTER TABLE open_loops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own open loops" ON open_loops FOR ALL USING (user_id = auth.uid());

GRANT ALL ON open_loops TO authenticated;
