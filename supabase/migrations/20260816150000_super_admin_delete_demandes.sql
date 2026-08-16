-- Conserve les droits existants sur les demandes et reserve leur suppression au Super Admin.
DROP POLICY IF EXISTS "own_demandes_all" ON public.demandes;

CREATE POLICY "own_demandes_select"
ON public.demandes
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "own_demandes_insert"
ON public.demandes
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own_demandes_update"
ON public.demandes
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "demandes_delete_super_admin"
ON public.demandes
FOR DELETE
TO authenticated
USING (public.is_super_admin(auth.uid()));
