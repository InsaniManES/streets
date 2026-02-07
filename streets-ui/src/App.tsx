import { useMemo, useState } from 'react'
import './App.css'
import { deleteStreet, searchStreets, type SearchMode, type StreetHit } from './api'
import * as React from "react";

const MODE_LABEL: Record<SearchMode, string> = {
    free: 'חיפוש חופשי (שם ראשי בלבד)',
    any: 'לפחות מילה אחת בכל השדות',
    phrase: 'ביטוי שלם בכל השדות',
}

const FIELD_LABEL: Record<string, string> = {
    namePrimary: 'שם ראשי',
    title: 'תואר',
    nameSecondary: 'שם משני',
    group: 'קבוצה',
    groupExtra: 'קבוצה נוספת',
    kind: 'סוג',
    code: 'קוד',
    neighborhood: 'שכונה',
}

export default function App() {
    const [q, setQ] = useState('')
    const [mode, setMode] = useState<SearchMode>('free')
    const [loading, setLoading] = useState(false)
    const [err, setErr] = useState<string | null>(null)
    const [hits, setHits] = useState<StreetHit[]>([])

    const canSearch = useMemo(() => q.trim().length > 0 && !loading, [q, loading])

    async function onSearch(e?: React.SubmitEvent<HTMLFormElement>) {
        e?.preventDefault()
        const query = q.trim()
        if (!query) return

        setLoading(true)
        setErr(null)
        try {
            const data = await searchStreets(query, mode)
            setHits(Array.isArray(data) ? data : [])
        } catch (e) {
            setErr(e instanceof Error ? e.message : 'Search failed')
            setHits([])
        } finally {
            setLoading(false)
        }
    }

    async function onDelete(id: string) {
        const prev = hits
        setHits(prev.filter(h => h.id !== id))
        setErr(null)

        try {
            await deleteStreet(id)
        } catch (e) {
            setHits(prev)
            setErr(e instanceof Error ? e.message : 'Delete failed')
        }
    }

    return (
        <div className="page" dir="rtl">
            <h1>חיפוש רחובות</h1>

            <form className="card" onSubmit={onSearch}>
                <div className="row">
                    <input
                        placeholder="הקלד טקסט לחיפוש…"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                    />
                    <button type="submit" disabled={!canSearch}>
                        {loading ? 'מחפש…' : 'חיפוש'}
                    </button>
                </div>

                <fieldset className="modes">
                    <legend>מצב חיפוש</legend>
                    {(['free', 'any', 'phrase'] as const).map((m) => (
                        <label key={m} className="radio">
                            <input
                                type="radio"
                                name="mode"
                                value={m}
                                checked={mode === m}
                                onChange={() => setMode(m)}
                            />
                            <span>{MODE_LABEL[m]}</span>
                        </label>
                    ))}
                </fieldset>

                {err && <div className="error" dir="ltr">{err}</div>}
            </form>

            <div className="resultsHeader">
                <h2>תוצאות</h2>
                <span>{hits.length}</span>
            </div>

            {hits.length === 0 && !loading && <div className="empty">אין תוצאות</div>}

            {hits.length > 0 && (
                <div className="tableWrap">
                    <table className="resultsTable">
                        <thead>
                            <tr>
                                <th>{FIELD_LABEL.namePrimary}</th>
                                <th>{FIELD_LABEL.title}</th>
                                <th>{FIELD_LABEL.nameSecondary}</th>
                                <th>{FIELD_LABEL.group}</th>
                                <th>{FIELD_LABEL.kind}</th>
                                <th>{FIELD_LABEL.neighborhood}</th>
                                <th className="thAction"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {hits.map((h) => (
                                <tr key={h.id}>
                                    <td>{h.namePrimary ?? ''}</td>
                                    <td>{h.title ?? ''}</td>
                                    <td>{h.nameSecondary ?? ''}</td>
                                    <td>{h.group ?? ''}</td>
                                    <td>{h.kind ?? ''}</td>
                                    <td>{h.neighborhood ?? ''}</td>
                                    <td className="tdAction">
                                        <button type="button" className="danger" onClick={() => onDelete(h.id)}>מחק</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
