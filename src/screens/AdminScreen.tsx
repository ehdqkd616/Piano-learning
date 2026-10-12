import { useCallback, useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { adminApi, type AdminUser, type AuditItem } from '@/api'
import { useAppStore } from '@/store/useAppStore'
import './AdminScreen.css'

const STATUS_LABEL: Record<string, string> = {
  pending: '승인 대기',
  approved: '승인됨',
  rejected: '거절됨',
  suspended: '정지됨',
}

const fmt = (v: string | null) =>
  v ? new Date(v).toLocaleString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'

export function AdminScreen() {
  const navigate = useNavigate()
  const user = useAppStore((s) => s.user)
  const [tab, setTab] = useState<'users' | 'audit'>('users')

  if (user && user.role !== 'admin') return <Navigate to="/" replace />

  return (
    <div className="admin-screen">
      <header className="admin-header">
        <button className="btn-icon" onClick={() => navigate('/')}>← 홈</button>
        <h1>관리자</h1>
      </header>
      <Stats />
      <div className="admin-tabs">
        <button className={tab === 'users' ? 'on' : ''} onClick={() => setTab('users')}>회원 관리</button>
        <button className={tab === 'audit' ? 'on' : ''} onClick={() => setTab('audit')}>감사 로그</button>
      </div>
      {tab === 'users' ? <Users /> : <Audit />}
    </div>
  )
}

function Stats() {
  const [data, setData] = useState<Awaited<ReturnType<typeof adminApi.stats>> | null>(null)
  useEffect(() => {
    adminApi.stats().then(setData, () => {})
  }, [])
  if (!data) return null
  return (
    <div className="admin-tiles">
      <div className={`admin-tile ${data.users.pending ? 'attention' : ''}`}><span>승인 대기</span><b>{data.users.pending}</b></div>
      <div className="admin-tile"><span>전체 회원</span><b>{data.users.total}</b></div>
      <div className="admin-tile"><span>오늘 로그인</span><b>{data.today.logins}</b></div>
      <div className="admin-tile"><span>오늘 연습</span><b>{data.today.sessions}</b></div>
    </div>
  )
}

function Users() {
  const [status, setStatus] = useState('pending')
  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<AdminUser[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const me = useAppStore((s) => s.user)

  const load = useCallback(() => {
    adminApi.users(status, query).then((r) => setItems(r.items), (e) => setMsg({ ok: false, text: e.message }))
  }, [status, query])
  useEffect(load, [load])

  const act = async (fn: () => Promise<unknown>, okText?: string) => {
    setMsg(null)
    try {
      await fn()
      if (okText) setMsg({ ok: true, text: okText })
      setSelected(new Set())
      load()
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message })
    }
  }

  const pendingIds = items?.filter((u) => u.status === 'pending').map((u) => u.id) ?? []
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  return (
    <section className="admin-card">
      <div className="admin-toolbar">
        <div className="admin-chips">
          {[['', '전체'], ...Object.entries(STATUS_LABEL)].map(([k, label]) => (
            <button key={k} className={status === k ? 'on' : ''} onClick={() => setStatus(k)}>{label}</button>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); setQuery(q.trim()) }}>
          <input className="admin-search" placeholder="아이디·닉네임 검색 (Enter)" value={q} onChange={(e) => setQ(e.target.value)} />
        </form>
      </div>

      {pendingIds.length > 0 && (
        <div className="admin-bulk">
          <label>
            <input
              type="checkbox"
              checked={pendingIds.every((id) => selected.has(id))}
              onChange={(e) => setSelected(e.target.checked ? new Set(pendingIds) : new Set())}
            />
            승인 대기 전체 선택
          </label>
          <button className="btn" disabled={!selected.size}
            onClick={() => act(() => adminApi.bulkApprove([...selected]), `${selected.size}명을 승인했습니다.`)}>
            선택한 {selected.size}명 승인
          </button>
        </div>
      )}

      {msg && <p className={`admin-msg ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</p>}
      {!items ? <p className="admin-empty">불러오는 중...</p> : items.length === 0 ? <p className="admin-empty">회원이 없습니다.</p> : (
        <ul className="admin-list">
          {items.map((u) => (
            <li key={u.id} className={u.status === 'pending' ? 'pending' : ''}>
              <div className="admin-user">
                {u.status === 'pending' && (
                  <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggle(u.id)} aria-label={`${u.username} 선택`} />
                )}
                <div>
                  <div className="admin-user__name">
                    {u.username} <span className="muted">{u.nickname}</span>
                    {u.role === 'admin' && <span className="tag admin">관리자</span>}
                    <span className={`tag ${u.status}`}>{STATUS_LABEL[u.status]}</span>
                  </div>
                  {u.signupNote && <div className="admin-note">메모: {u.signupNote}</div>}
                  {u.rejectReason && <div className="admin-note err">거절 사유: {u.rejectReason}</div>}
                  <div className="muted small">
                    가입 {fmt(u.createdAt)} · 최근 로그인 {fmt(u.lastLoginAt)} · Lv.{u.level} · 연습 {u.sessionCount ?? 0}회
                  </div>
                </div>
              </div>
              {u.id !== me?.userId && (
                <div className="admin-actions">
                  {(u.status === 'pending' || u.status === 'rejected') && (
                    <button className="btn btn--primary" onClick={() => act(() => adminApi.approve(u.id), `${u.username} 승인`)}>승인</button>
                  )}
                  {u.status === 'pending' && (
                    <button className="btn" onClick={() => {
                      const reason = window.prompt(`${u.username}의 가입을 거절합니다. 사유 (선택, 로그인할 때 회원에게 표시됨)`)
                      if (reason !== null) act(() => adminApi.reject(u.id, reason), `${u.username} 거절`)
                    }}>거절</button>
                  )}
                  {u.status === 'approved' && u.role !== 'admin' && (
                    <button className="btn btn--danger" onClick={() =>
                      window.confirm(`${u.username}을(를) 정지할까요? 바로 로그아웃됩니다.`) && act(() => adminApi.suspend(u.id), `${u.username} 정지`)}>정지</button>
                  )}
                  {u.status === 'suspended' && (
                    <button className="btn" onClick={() => act(() => adminApi.unsuspend(u.id), `${u.username} 정지 해제`)}>정지 해제</button>
                  )}
                  {u.username !== 'admin' && (
                    <button className="btn" onClick={() => {
                      if (!window.confirm(`${u.username}의 임시 비밀번호를 발급할까요? 기존 비밀번호와 로그인은 무효가 됩니다.`)) return
                      act(async () => {
                        const { tempPassword } = await adminApi.tempPassword(u.id)
                        setMsg({ ok: true, text: `임시 비밀번호: ${tempPassword} (지금 한 번만 표시됩니다. 회원에게 전달하세요.)` })
                      })
                    }}>임시 비번</button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

const AUDIT_FILTERS: [string, string][] = [['', '전체'], ['user.', '회원'], ['login.', '로그인'], ['admin.', '관리자 조치']]

function Audit() {
  const [action, setAction] = useState('')
  const [items, setItems] = useState<AuditItem[] | null>(null)
  useEffect(() => {
    setItems(null)
    adminApi.audit(action).then((r) => setItems(r.items), () => setItems([]))
  }, [action])
  return (
    <section className="admin-card">
      <div className="admin-chips">
        {AUDIT_FILTERS.map(([k, label]) => (
          <button key={k} className={action === k ? 'on' : ''} onClick={() => setAction(k)}>{label}</button>
        ))}
      </div>
      {!items ? <p className="admin-empty">불러오는 중...</p> : items.length === 0 ? <p className="admin-empty">기록이 없습니다.</p> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>일시</th><th>동작</th><th>수행자</th><th>대상</th><th>내용</th><th>IP</th></tr></thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id}>
                  <td>{fmt(a.createdAt)}</td>
                  <td className="mono">{a.action}</td>
                  <td>{a.actorUsername ?? '-'}</td>
                  <td>{a.targetUsername ?? '-'}</td>
                  <td className="mono">{a.detail ? JSON.stringify(a.detail) : ''}</td>
                  <td>{a.ip ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
