CREATE OR REPLACE FUNCTION public.enforce_ticket_child_integration()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_integration_id uuid;
BEGIN
  SELECT support_integration_id INTO parent_integration_id FROM public.tickets WHERE id = NEW.ticket_id;
  IF NEW.support_integration_id IS DISTINCT FROM parent_integration_id THEN
    RAISE EXCEPTION 'support_integration_id ne correspond pas au ticket parent' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS ticket_comments_parent_integration_guard ON public.ticket_comments;
--> statement-breakpoint
CREATE TRIGGER ticket_comments_parent_integration_guard
BEFORE INSERT OR UPDATE OF ticket_id, support_integration_id ON public.ticket_comments
FOR EACH ROW EXECUTE FUNCTION public.enforce_ticket_child_integration();
--> statement-breakpoint
DROP TRIGGER IF EXISTS ticket_history_parent_integration_guard ON public.ticket_history;
--> statement-breakpoint
CREATE TRIGGER ticket_history_parent_integration_guard
BEFORE INSERT OR UPDATE OF ticket_id, support_integration_id ON public.ticket_history
FOR EACH ROW EXECUTE FUNCTION public.enforce_ticket_child_integration();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.enforce_attachment_parent_integration()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_integration_id uuid;
BEGIN
  IF NEW.ticket_id IS NOT NULL THEN
    SELECT support_integration_id INTO parent_integration_id FROM public.tickets WHERE id = NEW.ticket_id;
  ELSIF NEW.comment_id IS NOT NULL THEN
    SELECT support_integration_id INTO parent_integration_id FROM public.ticket_comments WHERE id = NEW.comment_id;
  ELSIF NEW.support_message_id IS NOT NULL THEN
    SELECT support_integration_id INTO parent_integration_id FROM public.support_messages WHERE id = NEW.support_message_id;
  ELSIF NEW.internal_note_id IS NOT NULL THEN
    SELECT t.support_integration_id INTO parent_integration_id
    FROM public.ticket_internal_notes n JOIN public.tickets t ON t.id = n.ticket_id
    WHERE n.id = NEW.internal_note_id;
  END IF;
  IF NEW.support_integration_id IS DISTINCT FROM parent_integration_id THEN
    RAISE EXCEPTION 'support_integration_id ne correspond pas au parent de la piece jointe' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS attachments_parent_integration_guard ON public.attachments;
--> statement-breakpoint
CREATE TRIGGER attachments_parent_integration_guard
BEFORE INSERT OR UPDATE OF ticket_id, comment_id, internal_note_id, support_message_id, support_integration_id ON public.attachments
FOR EACH ROW EXECUTE FUNCTION public.enforce_attachment_parent_integration();
