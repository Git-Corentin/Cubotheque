// Connexion à la base en ligne (Supabase).
// Laissez vide pour un fonctionnement 100 % local (données dans le navigateur).
// Ces deux valeurs sont publiques par conception : la sécurité repose sur les règles
// d'accès de la base (voir supabase/schema.sql). Ne mettez JAMAIS ici la clé « secret » / « service_role ».
export const SUPABASE = {
  url: 'https://shjafkvlhhtcgjexojbq.supabase.co',  // ex. 'https://abcdefghijkl.supabase.co'
  key: 'sb_publishable_gDjkpWGNGu6xzyqe8whVrw_0d9gEOQd',  // clé « publishable » (sb_publishable_…) ou ancienne clé « anon »
};