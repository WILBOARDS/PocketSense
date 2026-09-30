-- Pins is_minor()'s search path, as Supabase's security advisor asks for every function.
alter function public.is_minor(int) set search_path = '';
