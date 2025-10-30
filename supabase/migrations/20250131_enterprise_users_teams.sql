-- Enterprise User Management & Team Collaboration Migration
-- This migration extends the existing user system to support teams, organizations, and role-based access

-- First, add role column to existing users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member' CHECK (role IN ('super_admin', 'org_admin', 'team_lead', 'member', 'viewer')),
ADD COLUMN IF NOT EXISTS display_name TEXT,
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add trigger for users updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create organizations table
CREATE TABLE public.organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL, -- for URLs like /org/acme-corp
    description TEXT,
    logo_url TEXT,
    plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
    max_members INTEGER DEFAULT 5, -- enforced by plan
    max_teams INTEGER DEFAULT 1,   -- enforced by plan
    settings JSONB DEFAULT '{}'::jsonb,
    created_by UUID NOT NULL REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create teams table
CREATE TABLE public.teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#3B82F6', -- for UI theming
    is_default BOOLEAN DEFAULT false,
    created_by UUID NOT NULL REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, name)
);

-- Create organization memberships table
CREATE TABLE public.organization_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('org_admin', 'member')),
    invited_by UUID REFERENCES public.users(id),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, user_id)
);

-- Create team memberships table
CREATE TABLE public.team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('team_lead', 'member', 'viewer')),
    added_by UUID REFERENCES public.users(id),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(team_id, user_id)
);

-- Create invitations table for team/org invites
CREATE TABLE public.invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    invited_by UUID NOT NULL REFERENCES public.users(id),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Either org or team invitation, not both
    CHECK ((organization_id IS NOT NULL AND team_id IS NULL) OR (organization_id IS NULL AND team_id IS NOT NULL))
);

-- Create shared workspaces table
CREATE TABLE public.shared_workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES public.users(id),
    settings JSONB DEFAULT '{}'::jsonb, -- workspace-specific settings
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Either org-wide or team workspace
    CHECK ((organization_id IS NOT NULL AND team_id IS NULL) OR (organization_id IS NULL AND team_id IS NOT NULL))
);

-- Create audit log table for enterprise compliance
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL, -- 'create', 'update', 'delete', 'invite', 'remove', etc.
    resource_type TEXT NOT NULL, -- 'user', 'team', 'note', 'workspace', etc.
    resource_id UUID,
    details JSONB DEFAULT '{}'::jsonb, -- additional context
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add triggers for updated_at columns
CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON public.organizations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_teams_updated_at
    BEFORE UPDATE ON public.teams
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_shared_workspaces_updated_at
    BEFORE UPDATE ON public.shared_workspaces
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX organizations_slug_idx ON public.organizations(slug);
CREATE INDEX organizations_created_by_idx ON public.organizations(created_by);
CREATE INDEX teams_organization_id_idx ON public.teams(organization_id);
CREATE INDEX organization_members_org_id_idx ON public.organization_members(organization_id);
CREATE INDEX organization_members_user_id_idx ON public.organization_members(user_id);
CREATE INDEX team_members_team_id_idx ON public.team_members(team_id);
CREATE INDEX team_members_user_id_idx ON public.team_members(user_id);
CREATE INDEX invitations_token_idx ON public.invitations(token);
CREATE INDEX invitations_email_idx ON public.invitations(email);
CREATE INDEX invitations_expires_at_idx ON public.invitations(expires_at);
CREATE INDEX shared_workspaces_org_id_idx ON public.shared_workspaces(organization_id);
CREATE INDEX shared_workspaces_team_id_idx ON public.shared_workspaces(team_id);
CREATE INDEX audit_logs_org_id_idx ON public.audit_logs(organization_id);
CREATE INDEX audit_logs_user_id_idx ON public.audit_logs(user_id);
CREATE INDEX audit_logs_created_at_idx ON public.audit_logs(created_at DESC);
CREATE INDEX audit_logs_resource_idx ON public.audit_logs(resource_type, resource_id);

-- Extend notes table to support team sharing
ALTER TABLE public.notes 
ADD COLUMN IF NOT EXISTS shared_with_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS shared_with_organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'private' CHECK (visibility IN ('private', 'team', 'organization')),
ADD COLUMN IF NOT EXISTS shared_at TIMESTAMP WITH TIME ZONE;

-- Create index for shared notes
CREATE INDEX notes_shared_team_idx ON public.notes(shared_with_team_id) WHERE shared_with_team_id IS NOT NULL;
CREATE INDEX notes_shared_org_idx ON public.notes(shared_with_organization_id) WHERE shared_with_organization_id IS NOT NULL;
CREATE INDEX notes_visibility_idx ON public.notes(visibility);

-- Extend project_knowledge to support team knowledge bases
ALTER TABLE public.project_knowledge
ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'private' CHECK (visibility IN ('private', 'team', 'organization'));

-- Make user_id nullable for team/org knowledge bases
ALTER TABLE public.project_knowledge
ALTER COLUMN user_id DROP NOT NULL;

-- Add constraint: must have either user_id OR (team_id/organization_id)
ALTER TABLE public.project_knowledge
ADD CONSTRAINT project_knowledge_owner_check 
CHECK (
    (user_id IS NOT NULL AND team_id IS NULL AND organization_id IS NULL) OR
    (user_id IS NULL AND team_id IS NOT NULL AND organization_id IS NULL) OR
    (user_id IS NULL AND team_id IS NULL AND organization_id IS NOT NULL)
);

-- Create indexes for team/org knowledge
CREATE INDEX project_knowledge_team_idx ON public.project_knowledge(team_id) WHERE team_id IS NOT NULL;
CREATE INDEX project_knowledge_org_idx ON public.project_knowledge(organization_id) WHERE organization_id IS NOT NULL;

-- Helper function to create default team when organization is created
CREATE OR REPLACE FUNCTION public.create_default_team_for_org()
RETURNS TRIGGER AS $$
BEGIN
    -- Create a default "General" team for new organizations
    INSERT INTO public.teams (organization_id, name, description, is_default, created_by)
    VALUES (NEW.id, 'General', 'Default team for organization members', true, NEW.created_by);
    
    -- Add the creator as an org admin
    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'org_admin');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create default team on org creation
CREATE TRIGGER on_organization_created
    AFTER INSERT ON public.organizations
    FOR EACH ROW
    EXECUTE FUNCTION public.create_default_team_for_org();

-- Helper function to add user to default team when they join an org
CREATE OR REPLACE FUNCTION public.add_user_to_default_team()
RETURNS TRIGGER AS $$
DECLARE
    default_team_id UUID;
BEGIN
    -- Find the default team for this organization
    SELECT id INTO default_team_id
    FROM public.teams
    WHERE organization_id = NEW.organization_id AND is_default = true;
    
    -- Add user to default team as member
    IF default_team_id IS NOT NULL THEN
        INSERT INTO public.team_members (team_id, user_id, role, added_by)
        VALUES (default_team_id, NEW.user_id, 'member', NEW.invited_by)
        ON CONFLICT (team_id, user_id) DO NOTHING;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to add users to default team when they join an org
CREATE TRIGGER on_organization_member_added
    AFTER INSERT ON public.organization_members
    FOR EACH ROW
    EXECUTE FUNCTION public.add_user_to_default_team();

-- Function to log audit events
CREATE OR REPLACE FUNCTION public.log_audit_event(
    p_organization_id UUID,
    p_user_id UUID,
    p_action TEXT,
    p_resource_type TEXT,
    p_resource_id UUID DEFAULT NULL,
    p_details JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
    audit_id UUID;
BEGIN
    INSERT INTO public.audit_logs (
        organization_id, user_id, action, resource_type, resource_id, details
    ) VALUES (
        p_organization_id, p_user_id, p_action, p_resource_type, p_resource_id, p_details
    ) RETURNING id INTO audit_id;
    
    RETURN audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT ALL ON public.organizations TO authenticated, service_role;
GRANT ALL ON public.teams TO authenticated, service_role;
GRANT ALL ON public.organization_members TO authenticated, service_role;
GRANT ALL ON public.team_members TO authenticated, service_role;
GRANT ALL ON public.invitations TO authenticated, service_role;
GRANT ALL ON public.shared_workspaces TO authenticated, service_role;
GRANT ALL ON public.audit_logs TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.log_audit_event(UUID, UUID, TEXT, TEXT, UUID, JSONB) TO authenticated, service_role;