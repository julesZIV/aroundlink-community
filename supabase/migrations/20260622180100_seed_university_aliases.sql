-- Alias multilingues pour rendre certaines universités trouvables dans la langue
-- locale (le ROR ne stocke que le nom anglais). À compléter au cas par cas.
update public.universities set aliases = array['Universidad de Chile','UChile','FEN','Facultad de Economia y Negocios']
where id = 23344;  -- University of Chile (Santiago)

update public.universities set aliases = array['Université Mohammed Premier','Universidad Mohammed Premier','UMP','Mohammed Premier','Université Mohammed 1er','ump.ac.ma']
where id = 4930;   -- Mohamed I University (Oujda)
