-- Add super_admin to app_role enum, then promote bonjour@flowtravel.fr
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
