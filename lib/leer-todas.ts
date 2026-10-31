/**
 * Lee todas las filas de una consulta de Supabase de 1000 en 1000 (PostgREST
 * corta en 1000 por defecto). `consulta(desde, hasta)` debe devolver la consulta
 * con `.range(desde, hasta)` aplicado y un orden estable.
 */
export async function leerTodas<T>(
  consulta: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  tamano = 1000,
): Promise<{ data: T[]; error: string | null }> {
  const filas: T[] = []
  for (let desde = 0; ; desde += tamano) {
    const { data, error } = await consulta(desde, desde + tamano - 1)
    if (error) return { data: filas, error: error.message }
    filas.push(...(data ?? []))
    if (!data || data.length < tamano) return { data: filas, error: null }
  }
}
