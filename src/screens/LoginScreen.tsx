import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { login } from '@/api'
import { useAppStore } from '@/store/useAppStore'
import { ApiError } from '@/api/client'
import './AuthScreen.css'

export function LoginScreen() {
  const navigate = useNavigate()
  const setUser = useAppStore((s) => s.setUser)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const user = await login(email, password)
      setUser(user)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '로그인에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>🎹 Piano Learning</h1>
        <p className="auth-card__sub">로그인하고 연습을 이어가세요</p>

        <label className="auth-label">
          이메일
          <input
            className="auth-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <label className="auth-label">
          비밀번호
          <input
            className="auth-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {error && <p className="auth-error">{error}</p>}

        <button className="auth-submit" type="submit" disabled={loading}>
          {loading ? '로그인 중...' : '로그인'}
        </button>

        <p className="auth-switch">
          계정이 없으신가요? <Link to="/signup">회원가입</Link>
        </p>
      </form>
    </div>
  )
}
