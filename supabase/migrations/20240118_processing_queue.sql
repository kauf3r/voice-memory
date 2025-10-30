-- Create processing queue table
CREATE TABLE public.processing_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    priority INTEGER NOT NULL DEFAULT 0,
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    error_message TEXT,
    scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX processing_queue_status_idx ON public.processing_queue(status);
CREATE INDEX processing_queue_scheduled_idx ON public.processing_queue(scheduled_at);
CREATE INDEX processing_queue_user_idx ON public.processing_queue(user_id);
CREATE INDEX processing_queue_priority_idx ON public.processing_queue(priority DESC, scheduled_at ASC);

-- Function to automatically add notes to processing queue
CREATE OR REPLACE FUNCTION public.add_note_to_processing_queue()
RETURNS TRIGGER AS $$
BEGIN
    -- Only add to queue if note doesn't have analysis yet
    IF NEW.analysis IS NULL AND NEW.transcription IS NULL THEN
        INSERT INTO public.processing_queue (note_id, user_id, priority)
        VALUES (NEW.id, NEW.user_id, 1);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-add new notes to processing queue
CREATE TRIGGER add_note_to_queue_trigger
    AFTER INSERT ON public.notes
    FOR EACH ROW
    EXECUTE FUNCTION public.add_note_to_processing_queue();

-- Function to update queue status when note is processed
CREATE OR REPLACE FUNCTION public.update_processing_queue_on_note_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Mark as completed if note now has analysis
    IF NEW.processed_at IS NOT NULL AND OLD.processed_at IS NULL THEN
        UPDATE public.processing_queue 
        SET 
            status = 'completed',
            completed_at = NEW.processed_at,
            updated_at = NOW()
        WHERE note_id = NEW.id AND status != 'completed';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update queue when note is processed
CREATE TRIGGER update_queue_on_note_update_trigger
    AFTER UPDATE ON public.notes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_processing_queue_on_note_update();

-- Function to get next notes to process
CREATE OR REPLACE FUNCTION public.get_next_notes_to_process(batch_size INTEGER DEFAULT 5)
RETURNS TABLE (
    queue_id UUID,
    note_id UUID,
    user_id UUID,
    audio_url TEXT,
    priority INTEGER,
    attempts INTEGER
) AS $$
BEGIN
    RETURN QUERY
    UPDATE public.processing_queue 
    SET 
        status = 'processing',
        started_at = NOW(),
        updated_at = NOW()
    WHERE id IN (
        SELECT pq.id
        FROM public.processing_queue pq
        JOIN public.notes n ON pq.note_id = n.id
        WHERE pq.status = 'pending' 
        AND pq.attempts < pq.max_attempts
        AND pq.scheduled_at <= NOW()
        ORDER BY pq.priority DESC, pq.scheduled_at ASC
        LIMIT batch_size
        FOR UPDATE SKIP LOCKED
    )
    RETURNING 
        public.processing_queue.id as queue_id,
        public.processing_queue.note_id,
        public.processing_queue.user_id,
        (SELECT notes.audio_url FROM public.notes WHERE notes.id = public.processing_queue.note_id) as audio_url,
        public.processing_queue.priority,
        public.processing_queue.attempts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark processing attempt as failed
CREATE OR REPLACE FUNCTION public.mark_processing_failed(
    queue_id_param UUID,
    error_msg TEXT
)
RETURNS VOID AS $$
DECLARE
    current_attempts INTEGER;
    max_attempts_val INTEGER;
BEGIN
    -- Get current attempts and max attempts
    SELECT attempts, max_attempts INTO current_attempts, max_attempts_val
    FROM public.processing_queue
    WHERE id = queue_id_param;
    
    -- Update the queue record
    UPDATE public.processing_queue
    SET 
        attempts = attempts + 1,
        error_message = error_msg,
        status = CASE 
            WHEN attempts + 1 >= max_attempts_val THEN 'failed'
            ELSE 'pending'
        END,
        -- Exponential backoff for retries
        scheduled_at = CASE 
            WHEN attempts + 1 < max_attempts_val THEN NOW() + INTERVAL '1 minute' * POWER(2, attempts + 1)
            ELSE scheduled_at
        END,
        updated_at = NOW()
    WHERE id = queue_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get processing statistics
CREATE OR REPLACE FUNCTION public.get_processing_stats(user_id_param UUID)
RETURNS TABLE (
    total_notes INTEGER,
    pending INTEGER,
    processing INTEGER,
    completed INTEGER,
    failed INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_notes,
        COUNT(CASE WHEN status = 'pending' THEN 1 END)::INTEGER as pending,
        COUNT(CASE WHEN status = 'processing' THEN 1 END)::INTEGER as processing,
        COUNT(CASE WHEN status = 'completed' THEN 1 END)::INTEGER as completed,
        COUNT(CASE WHEN status = 'failed' THEN 1 END)::INTEGER as failed
    FROM public.processing_queue
    WHERE public.processing_queue.user_id = user_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;