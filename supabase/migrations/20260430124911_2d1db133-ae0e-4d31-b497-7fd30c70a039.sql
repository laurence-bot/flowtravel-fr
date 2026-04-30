-- Permettre aux super admins de supprimer les error_logs
CREATE POLICY "errors_delete_super_admin"
ON public.error_logs
FOR DELETE
TO authenticated
USING (is_super_admin(auth.uid()));