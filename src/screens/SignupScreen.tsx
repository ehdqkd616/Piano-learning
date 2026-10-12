import { useState } from 'react'
import { Link } from 'react-router-dom'
import { signup } from '@/api'
import { ApiError } from '@/api/client'
import './AuthScreen.css'

export function SignupScreen() {
  const [nickname, setNickname] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [signupNote, setSignupNote] = useState('')
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreePrivacy, setAgreePrivacy] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const { message } = await signup({
        username: username.trim(),
        password,
        nickname,
        signupNote: signupNote.trim() || undefined,
        agreeTerms,
        agreePrivacy,
      })
      setDone(message)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '회원가입에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <h1>🎹 가입 신청 완료</h1>
          <p className="auth-notice">{done}</p>
          <p className="auth-switch"><Link to="/login">로그인 화면으로</Link></p>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>🎹 Piano Learning</h1>
        <p className="auth-card__sub">가입 후 관리자 승인이 끝나면 이용할 수 있어요</p>

        <label className="auth-label">
          닉네임
          <input
            className="auth-input"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="피아니스트"
            autoComplete="nickname"
          />
        </label>
        <label className="auth-label">
          아이디 (영문·숫자 3~32자)
          <input
            className="auth-input"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            pattern="[A-Za-z0-9_\-]{3,32}"
            title="영문, 숫자, _, - 조합 3~32자"
            maxLength={32}
            required
          />
        </label>
        <label className="auth-label">
          비밀번호 (8자 이상)
          <input
            className="auth-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        <label className="auth-label">
          비밀번호 확인
          <input
            className="auth-input"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        <label className="auth-label">
          가입 메모 (선택) — 사용 목적 등을 남기면 승인이 빨라요
          <textarea
            className="auth-input auth-textarea"
            value={signupNote}
            onChange={(e) => setSignupNote(e.target.value)}
            maxLength={1000}
            rows={2}
          />
        </label>

        <details className="auth-terms">
          <summary>이용약관 · 개인정보 처리방침 보기</summary>
          <p><b>이용약관</b> — 승인된 회원에게 피아노 연습·연주 기록 기능을 제공합니다. 남용 시 이용이 정지될 수 있습니다.</p>
          <p><b>개인정보 처리방침</b> — 수집 항목: 아이디, 닉네임, 가입 메모, 접속 기록, 연습 기록. 이용 목적: 회원 관리와 서비스 제공. 탈퇴를 원하면 관리자에게 요청하세요.</p>
        </details>
        <label className="auth-check">
          <input type="checkbox" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} /> 이용약관에 동의합니다 (필수)
        </label>
        <label className="auth-check">
          <input type="checkbox" checked={agreePrivacy} onChange={(e) => setAgreePrivacy(e.target.checked)} /> 개인정보 수집·이용에 동의합니다 (필수)
        </label>

        {error && <p className="auth-error">{error}</p>}

        <button className="auth-submit" type="submit" disabled={loading || !agreeTerms || !agreePrivacy}>
          {loading ? '가입 중...' : '가입 신청'}
        </button>

        <p className="auth-switch">
          이미 계정이 있으신가요? <Link to="/login">로그인</Link>
        </p>
      </form>
    </div>
  )
}
