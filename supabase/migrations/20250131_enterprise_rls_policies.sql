-- Row Level Security Policies for Enterprise Features
-- This migration sets up comprehensive RLS policies for team/organization access control

-- Enable RLS on all enterprise tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Organizations policies
-- Users can view organizations they belong to
CREATE POLICY "Users can view organizations they belong to"
    ON public.organizations
    FOR SELECT
    USING (
        id IN (
            SELECT organization_id 
            FROM public.organization_members 
            WHERE user_id = auth.uid()
        )
    );

-- Users can create organizations (for pro/enterprise plans)
CREATE POLICY "Authenticated users can create organizations"
    ON public.organizations
    FOR INSERT
    WITH CHECK (auth.uid() = created_by);

-- Org admins can update their organizations
CREATE POLICY "Org admins can update their organizations"
    ON public.organizations
    FOR UPDATE
    USING (
        id IN (
            SELECT organization_id 
            FROM public.organization_members 
            WHERE user_id = auth.uid() AND role = 'org_admin'
        )
    );

-- Only org admins can delete organizations
CREATE POLICY "Org admins can delete their organizations"
    ON public.organizations
    FOR DELETE
    USING (
        id IN (
            SELECT organization_id 
            FROM public.organization_members 
            WHERE user_id = auth.uid() AND role = 'org_admin'
        )
    );

-- Teams policies
-- Users can view teams in their organizations
CREATE POLICY "Users can view teams in their organizations"
    ON public.teams
    FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id 
            FROM public.organization_members 
            WHERE user_id = auth.uid()
        )
    );

-- Org admins and team leads can create teams
CREATE POLICY "Org admins can create teams"
    ON public.teams
    FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id 
            FROM public.organization_members 
            WHERE user_id = auth.uid() AND role = 'org_admin'
        )
        AND auth.uid() = created_by
    );

-- Team leads and org admins can update teams
CREATE POLICY "Team leads and org admins can update teams"
    ON public.teams
    FOR UPDATE
    USING (
        -- Org admin access
        organization_id IN (
            SELECT organization_id 
            FROM public.organization_members 
            WHERE user_id = auth.uid() AND role = 'org_admin'
        )
        OR
        -- Team lead access
        id IN (
            SELECT team_id 
            FROM public.team_members 
            WHERE user_id = auth.uid() AND role = 'team_lead'
        )
    );

-- Only org admins can delete teams
CREATE POLICY "Org admins can delete teams"
    ON public.teams
    FOR DELETE
    USING (
        organization_id IN (
            SELECT organization_id 
            FROM public.organization_members 
            WHERE user_id = auth.uid() AND role = 'org_admin'
        )
    );

-- Organization members policies
-- Users can view org members in their organizations
CREATE POLICY "Users can view org members in their organizations"
    ON public.organization_members
    FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id 
            FROM public.organization_members 
            WHERE user_id = auth.uid()
        )
    );

-- Org admins can add/remove members
CREATE POLICY "Org admins can manage org members"
    ON public.organization_members
    FOR ALL
    USING (
        organization_id IN (
            SELECT organization_id 
            FROM public.organization_members 
            WHERE user_id = auth.uid() AND role = 'org_admin'
        )
    );

-- Users can leave organizations (delete their own membership)
CREATE POLICY "Users can leave organizations"
    ON public.organization_members
    FOR DELETE
    USING (user_id = auth.uid());

-- Team members policies
-- Users can view team members in their teams
CREATE POLICY "Users can view team members in their teams"
    ON public.team_members
    FOR SELECT
    USING (
        team_id IN (
            SELECT team_id 
            FROM public.team_members 
            WHERE user_id = auth.uid()
        )
        OR
        -- Org admins can see all team members in their org
        team_id IN (
            SELECT t.id 
            FROM public.teams t
            JOIN public.organization_members om ON t.organization_id = om.organization_id
            WHERE om.user_id = auth.uid() AND om.role = 'org_admin'
        )
    );

-- Team leads and org admins can manage team members
CREATE POLICY "Team leads and org admins can manage team members"
    ON public.team_members
    FOR ALL
    USING (
        -- Team lead access
        team_id IN (
            SELECT team_id 
            FROM public.team_members 
            WHERE user_id = auth.uid() AND role = 'team_lead'
        )
        OR
        -- Org admin access
        team_id IN (
            SELECT t.id 
            FROM public.teams t
            JOIN public.organization_members om ON t.organization_id = om.organization_id
            WHERE om.user_id = auth.uid() AND om.role = 'org_admin'
        )
    );

-- Users can leave teams (delete their own membership)
CREATE POLICY "Users can leave teams"
    ON public.team_members
    FOR DELETE
    USING (user_id = auth.uid());

-- Invitations policies
-- Users can view invitations they sent or received
CREATE POLICY "Users can view relevant invitations"
    ON public.invitations
    FOR SELECT
    USING (
        invited_by = auth.uid() -- invitations they sent
        OR 
        email = (SELECT email FROM auth.users WHERE id = auth.uid()) -- invitations they received
        OR
        -- Org admins can see org invitations
        organization_id IN (
            SELECT organization_id 
            FROM public.organization_members 
            WHERE user_id = auth.uid() AND role = 'org_admin'
        )
        OR
        -- Team leads can see team invitations
        team_id IN (
            SELECT team_id 
            FROM public.team_members 
            WHERE user_id = auth.uid() AND role = 'team_lead'
        )
    );

-- Org admins and team leads can create invitations
CREATE POLICY "Org admins and team leads can create invitations"
    ON public.invitations
    FOR INSERT
    WITH CHECK (
        auth.uid() = invited_by
        AND
        (
            -- Org admin inviting to org
            (organization_id IS NOT NULL AND organization_id IN (
                SELECT organization_id 
                FROM public.organization_members 
                WHERE user_id = auth.uid() AND role = 'org_admin'
            ))
            OR
            -- Team lead inviting to team
            (team_id IS NOT NULL AND team_id IN (
                SELECT team_id 
                FROM public.team_members 
                WHERE user_id = auth.uid() AND role = 'team_lead'
            ))
        )
    );

-- Users can update invitations they sent
CREATE POLICY "Users can update invitations they sent"
    ON public.invitations
    FOR UPDATE
    USING (invited_by = auth.uid());

-- Users can delete invitations they sent
CREATE POLICY "Users can delete invitations they sent"
    ON public.invitations
    FOR DELETE
    USING (invited_by = auth.uid());

-- Shared workspaces policies
-- Users can view workspaces in their teams/orgs
CREATE POLICY "Users can view workspaces in their teams/orgs"
    ON public.shared_workspaces
    FOR SELECT
    USING (
        -- Team workspace access
        (team_id IS NOT NULL AND team_id IN (
            SELECT team_id 
            FROM public.team_members 
            WHERE user_id = auth.uid()
        ))
        OR
        -- Org workspace access
        (organization_id IS NOT NULL AND organization_id IN (
            SELECT organization_id 
            FROM public.organization_members 
            WHERE user_id = auth.uid()
        ))
    );

-- Team leads and org admins can create workspaces
CREATE POLICY "Team leads and org admins can create workspaces"
    ON public.shared_workspaces
    FOR INSERT
    WITH CHECK (
        auth.uid() = created_by
        AND
        (
            -- Team lead creating team workspace
            (team_id IS NOT NULL AND team_id IN (
                SELECT team_id 
                FROM public.team_members 
                WHERE user_id = auth.uid() AND role = 'team_lead'
            ))
            OR
            -- Org admin creating org workspace
            (organization_id IS NOT NULL AND organization_id IN (
                SELECT organization_id 
                FROM public.organization_members 
                WHERE user_id = auth.uid() AND role = 'org_admin'
            ))
        )
    );

-- Team leads and org admins can update workspaces
CREATE POLICY "Team leads and org admins can update workspaces"
    ON public.shared_workspaces
    FOR UPDATE
    USING (
        -- Team lead access
        (team_id IS NOT NULL AND team_id IN (
            SELECT team_id 
            FROM public.team_members 
            WHERE user_id = auth.uid() AND role = 'team_lead'
        ))
        OR
        -- Org admin access
        (organization_id IS NOT NULL AND organization_id IN (
            SELECT organization_id 
            FROM public.organization_members 
            WHERE user_id = auth.uid() AND role = 'org_admin'
        ))
    );

-- Only creators and org admins can delete workspaces
CREATE POLICY "Creators and org admins can delete workspaces"
    ON public.shared_workspaces
    FOR DELETE
    USING (
        created_by = auth.uid()
        OR
        (organization_id IS NOT NULL AND organization_id IN (
            SELECT organization_id 
            FROM public.organization_members 
            WHERE user_id = auth.uid() AND role = 'org_admin'
        ))
    );

-- Audit logs policies
-- Only org admins can view audit logs for their organization
CREATE POLICY "Org admins can view audit logs for their organization"
    ON public.audit_logs
    FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id 
            FROM public.organization_members 
            WHERE user_id = auth.uid() AND role = 'org_admin'
        )
    );

-- Service role can insert audit logs
CREATE POLICY "Service role can insert audit logs"
    ON public.audit_logs
    FOR INSERT
    WITH CHECK (auth.role() = 'service_role');

-- Updated notes policies for team sharing
-- Drop existing policies for notes to recreate with team support
DROP POLICY IF EXISTS "Users can view own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can insert own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can update own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can delete own notes" ON public.notes;

-- Recreate notes policies with team/org sharing support
CREATE POLICY "Users can view accessible notes"
    ON public.notes
    FOR SELECT
    USING (
        -- Own notes
        auth.uid() = user_id
        OR
        -- Team shared notes
        (visibility = 'team' AND shared_with_team_id IN (
            SELECT team_id 
            FROM public.team_members 
            WHERE user_id = auth.uid()
        ))
        OR
        -- Org shared notes
        (visibility = 'organization' AND shared_with_organization_id IN (
            SELECT organization_id 
            FROM public.organization_members 
            WHERE user_id = auth.uid()
        ))
    );

CREATE POLICY "Users can insert own notes"
    ON public.notes
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notes"
    ON public.notes
    FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notes"
    ON public.notes
    FOR DELETE
    USING (auth.uid() = user_id);

-- Updated project knowledge policies for team sharing
-- Drop existing policies for project_knowledge
DROP POLICY IF EXISTS "Users can view own project knowledge" ON public.project_knowledge;
DROP POLICY IF EXISTS "Users can update own project knowledge" ON public.project_knowledge;

-- Recreate project knowledge policies with team/org support
CREATE POLICY "Users can view accessible project knowledge"
    ON public.project_knowledge
    FOR SELECT
    USING (
        -- Own knowledge
        auth.uid() = user_id
        OR
        -- Team knowledge
        (visibility = 'team' AND team_id IN (
            SELECT team_id 
            FROM public.team_members 
            WHERE user_id = auth.uid()
        ))
        OR
        -- Org knowledge
        (visibility = 'organization' AND organization_id IN (
            SELECT organization_id 
            FROM public.organization_members 
            WHERE user_id = auth.uid()
        ))
    );

CREATE POLICY "Users can insert project knowledge"
    ON public.project_knowledge
    FOR INSERT
    WITH CHECK (
        -- Personal knowledge
        (auth.uid() = user_id AND team_id IS NULL AND organization_id IS NULL)
        OR
        -- Team knowledge (team leads only)
        (user_id IS NULL AND team_id IS NOT NULL AND team_id IN (
            SELECT team_id 
            FROM public.team_members 
            WHERE user_id = auth.uid() AND role = 'team_lead'
        ))
        OR
        -- Org knowledge (org admins only)
        (user_id IS NULL AND organization_id IS NOT NULL AND organization_id IN (
            SELECT organization_id 
            FROM public.organization_members 
            WHERE user_id = auth.uid() AND role = 'org_admin'
        ))
    );

CREATE POLICY "Users can update accessible project knowledge"
    ON public.project_knowledge
    FOR UPDATE
    USING (
        -- Own knowledge
        auth.uid() = user_id
        OR
        -- Team knowledge (team leads only)
        (team_id IS NOT NULL AND team_id IN (
            SELECT team_id 
            FROM public.team_members 
            WHERE user_id = auth.uid() AND role = 'team_lead'
        ))
        OR
        -- Org knowledge (org admins only)
        (organization_id IS NOT NULL AND organization_id IN (
            SELECT organization_id 
            FROM public.organization_members 
            WHERE user_id = auth.uid() AND role = 'org_admin'
        ))
    );

-- Add policy for users to view their own extended profile
CREATE POLICY "Users can view extended profile info"
    ON public.users
    FOR SELECT
    USING (
        auth.uid() = id
        OR
        -- Team members can view each other's basic info
        id IN (
            SELECT DISTINCT tm2.user_id
            FROM public.team_members tm1
            JOIN public.team_members tm2 ON tm1.team_id = tm2.team_id
            WHERE tm1.user_id = auth.uid()
        )
        OR
        -- Org members can view each other's basic info
        id IN (
            SELECT DISTINCT om2.user_id
            FROM public.organization_members om1
            JOIN public.organization_members om2 ON om1.organization_id = om2.organization_id
            WHERE om1.user_id = auth.uid()
        )
    );

-- Super admins can see everything (for system administration)
CREATE POLICY "Super admins can view all organizations"
    ON public.organizations
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- Apply super admin policies to other tables as needed
CREATE POLICY "Super admins can view all teams"
    ON public.teams
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

CREATE POLICY "Super admins can view all audit logs"
    ON public.audit_logs
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );