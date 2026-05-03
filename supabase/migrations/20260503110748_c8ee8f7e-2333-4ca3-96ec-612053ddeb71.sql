-- Fonction : un pays est-il dans l'UE (TVA sur marge applicable) ?
CREATE OR REPLACE FUNCTION public.is_eu_country(_pays text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT _pays IS NOT NULL AND lower(trim(_pays)) = ANY (ARRAY[
    'allemagne','autriche','belgique','bulgarie','chypre','croatie','danemark',
    'espagne','estonie','finlande','france','grèce','grece','hongrie','irlande',
    'italie','lettonie','lituanie','luxembourg','malte','pays-bas','pologne',
    'portugal','république tchèque','republique tcheque','tchéquie','tchequie',
    'roumanie','slovaquie','slovénie','slovenie','suède','suede'
  ]);
$$;

-- Trigger : aligne regime_tva sur pays_destination
-- - À l'insertion : applique systématiquement la règle.
-- - À la mise à jour : seulement si pays_destination change ET que regime_tva
--   n'est pas modifié explicitement dans la même requête (l'agent garde la main).
CREATE OR REPLACE FUNCTION public.sync_cotation_regime_tva()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  target_regime cotation_regime_tva;
BEGIN
  IF NEW.pays_destination IS NULL OR length(trim(NEW.pays_destination)) = 0 THEN
    RETURN NEW;
  END IF;

  target_regime := CASE
    WHEN public.is_eu_country(NEW.pays_destination) THEN 'marge_ue'::cotation_regime_tva
    ELSE 'hors_ue'::cotation_regime_tva
  END;

  IF TG_OP = 'INSERT' THEN
    NEW.regime_tva := target_regime;
    IF target_regime = 'hors_ue' THEN
      NEW.taux_tva_marge := 0;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.pays_destination IS DISTINCT FROM OLD.pays_destination
       AND NEW.regime_tva IS NOT DISTINCT FROM OLD.regime_tva THEN
      NEW.regime_tva := target_regime;
      IF target_regime = 'hors_ue' THEN
        NEW.taux_tva_marge := 0;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_cotation_regime_tva ON public.cotations;
CREATE TRIGGER trg_sync_cotation_regime_tva
BEFORE INSERT OR UPDATE OF pays_destination, regime_tva
ON public.cotations
FOR EACH ROW
EXECUTE FUNCTION public.sync_cotation_regime_tva();

-- Backfill : aligne les cotations existantes dont pays_destination est connu
UPDATE public.cotations
SET regime_tva = CASE
                   WHEN public.is_eu_country(pays_destination) THEN 'marge_ue'::cotation_regime_tva
                   ELSE 'hors_ue'::cotation_regime_tva
                 END,
    taux_tva_marge = CASE
                       WHEN public.is_eu_country(pays_destination) THEN taux_tva_marge
                       ELSE 0
                     END
WHERE pays_destination IS NOT NULL
  AND length(trim(pays_destination)) > 0;