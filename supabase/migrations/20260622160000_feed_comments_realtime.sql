-- Active le temps réel sur les commentaires du feed pour que les nouveaux
-- commentaires apparaissent chez TOUS les membres (pas seulement l'auteur du post).
alter publication supabase_realtime add table public.feed_comments;
