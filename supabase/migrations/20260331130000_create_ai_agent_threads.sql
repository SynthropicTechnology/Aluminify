-- Migration: Create ai_agent_threads and ai_agent_messages tables
-- Description: Conversation thread persistence for CopilotKit AI agents
-- Each user can have multiple conversation threads per agent
-- Author: AI Agents System
-- Date: 2026-03-31

-- 1. Create ai_agent_threads table
CREATE TABLE IF NOT EXISTS public.ai_agent_threads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Thread metadata
    title text,                                         -- Auto-generated or user-defined title
    is_archived boolean DEFAULT false,                  -- Soft archive (hide from list)

    -- Timestamps
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    last_message_at timestamptz DEFAULT now()           -- For sorting by recent activity
);

-- 2. Create ai_agent_messages table
CREATE TABLE IF NOT EXISTS public.ai_agent_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id uuid NOT NULL REFERENCES public.ai_agent_threads(id) ON DELETE CASCADE,

    -- Message content
    role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content text NOT NULL,

    -- Metadata
    metadata jsonb DEFAULT '{}'::jsonb,                 -- Tool calls, MCP responses, etc.

    -- Timestamps
    created_at timestamptz DEFAULT now() NOT NULL
);

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS idx_ai_agent_threads_empresa_id ON public.ai_agent_threads(empresa_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_threads_user_id ON public.ai_agent_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_threads_agent_id ON public.ai_agent_threads(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_threads_last_message ON public.ai_agent_threads(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_agent_threads_user_agent ON public.ai_agent_threads(user_id, agent_id, is_archived)
    WHERE is_archived = false;

CREATE INDEX IF NOT EXISTS idx_ai_agent_messages_thread_id ON public.ai_agent_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_messages_created_at ON public.ai_agent_messages(thread_id, created_at ASC);

-- 4. Create updated_at trigger for threads
CREATE TRIGGER handle_updated_at_ai_agent_threads
    BEFORE UPDATE ON public.ai_agent_threads
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 5. Enable RLS
ALTER TABLE public.ai_agent_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_messages ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies - Threads

-- Users can only see their own threads
CREATE POLICY "Users can view their own threads"
    ON public.ai_agent_threads
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Users can create threads for themselves
CREATE POLICY "Users can create their own threads"
    ON public.ai_agent_threads
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Users can update their own threads (archive, rename)
CREATE POLICY "Users can update their own threads"
    ON public.ai_agent_threads
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Users can delete their own threads
CREATE POLICY "Users can delete their own threads"
    ON public.ai_agent_threads
    FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- 7. RLS Policies - Messages

-- Users can view messages from their own threads
CREATE POLICY "Users can view messages from their threads"
    ON public.ai_agent_messages
    FOR SELECT
    TO authenticated
    USING (
        thread_id IN (
            SELECT id FROM public.ai_agent_threads WHERE user_id = auth.uid()
        )
    );

-- Users can insert messages into their own threads
CREATE POLICY "Users can insert messages into their threads"
    ON public.ai_agent_messages
    FOR INSERT
    TO authenticated
    WITH CHECK (
        thread_id IN (
            SELECT id FROM public.ai_agent_threads WHERE user_id = auth.uid()
        )
    );

-- 8. Add comments
COMMENT ON TABLE public.ai_agent_threads IS 'Conversation threads for AI agent interactions. Each thread belongs to one user and one agent.';
COMMENT ON TABLE public.ai_agent_messages IS 'Individual messages within an AI agent conversation thread.';
COMMENT ON COLUMN public.ai_agent_threads.last_message_at IS 'Timestamp of the last message, used for sorting threads by recent activity.';
COMMENT ON COLUMN public.ai_agent_messages.role IS 'Message sender: user, assistant, or system.';
COMMENT ON COLUMN public.ai_agent_messages.metadata IS 'Additional data: tool calls, MCP responses, token usage, etc.';
