-- 0014_medication_schedule_validation.sql
CREATE OR REPLACE FUNCTION public.validate_medication_reminder()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.label := nullif(trim(NEW.label), '');
  IF NEW.label IS NULL THEN RAISE EXCEPTION 'medication schedule label is required'; END IF;
  IF jsonb_typeof(NEW.times) <> 'array' OR jsonb_array_length(NEW.times) NOT BETWEEN 1 AND 8 THEN
    RAISE EXCEPTION 'medication schedule must contain 1 to 8 times';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(NEW.times) value WHERE value !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$') THEN
    RAISE EXCEPTION 'medication times must use HH:MM';
  END IF;
  IF NEW.end_date IS NOT NULL AND NEW.end_date < NEW.start_date THEN
    RAISE EXCEPTION 'medication end date cannot precede start date';
  END IF;
  NEW.times := to_jsonb(ARRAY(
    SELECT DISTINCT value FROM jsonb_array_elements_text(NEW.times) value ORDER BY value
  ));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_validate_medication_reminder ON public.medication_reminders;
CREATE TRIGGER tr_validate_medication_reminder
BEFORE INSERT OR UPDATE ON public.medication_reminders
FOR EACH ROW EXECUTE FUNCTION public.validate_medication_reminder();
