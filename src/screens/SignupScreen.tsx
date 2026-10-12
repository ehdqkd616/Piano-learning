import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { signup } from '@/api'
import { useAppStore } from '@/store/useAppStore'
import { ApiError } from '@/api/client'
import './AuthScreen.css'

export function SignupScreen() {
  const navigate = useNavigate()
  const setUser = useAppStore((s) => s.setUser)
  const [nickname, setNickname] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
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
      const user = await signup(username.trim(), password, nickname)
      setUser(user)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '회원가입에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>🎹 Piano Learning</h1>
        <p className="auth-card__sub">새 계정을 만들어 시작하세요</p>

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

        {error && <p className="auth-error">{error}</p>}

        <button className="auth-submit" type="submit" disabled={loading}>
          {loading ? '가입 중...' : '회원가입'}
        </button>

        <p className="auth-switch">
          이미 계정이 있으신가요? <Link to="/login">로그인</Link>
        </p>
      </form>
    </div>
  )
}
