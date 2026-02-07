export type SearchMode = 'free' | 'any' | 'phrase'

export type StreetHit = {
    id: string
    namePrimary?: string
    title?: string
    nameSecondary?: string
    group?: string
    kind?: string
    neighborhood?: string
}

export async function searchStreets(q: string, mode: SearchMode): Promise<StreetHit[]> {
    const url = new URL('/api/search', window.location.origin)
    url.searchParams.set('q', q)
    url.searchParams.set('mode', mode)

    const res = await fetch(url.toString(), { method: 'GET' })
    const text = await res.text()
    if (!res.ok) {
        let msg = `Search failed: ${res.status}`
        try {
            const body = JSON.parse(text) as { details?: string; error?: string }
            if (body.details) msg = body.details
            else if (body.error) msg = body.error
        } catch {
            /* use default msg */
        }
        throw new Error(msg)
    }
    try {
        return JSON.parse(text) as StreetHit[]
    } catch {
        throw new Error('Server returned invalid response. Is the API running on the correct port?')
    }
}

export async function deleteStreet(id: string): Promise<void> {
    const url = new URL(`/api/streets/${encodeURIComponent(id)}`, window.location.origin)
    const res = await fetch(url.toString(), { method: 'DELETE' })
    if (!res.ok) throw new Error(`Delete failed: ${res.status}`)
}
