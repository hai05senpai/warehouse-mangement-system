import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Boxes, LogIn, ShieldCheck } from 'lucide-react'
import { api, errorMessage, setStoredAuth, type LoginResponse } from '../api'
import { Field, Notice } from '../components/Page'

export function Login() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const response = await api.post<LoginResponse>('/auth/login', {
        username: username.trim(),
        password,
      })
      setStoredAuth(response.data.token, response.data.admin)
      navigate('/dashboard', { replace: true })
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-shell">
      <div className="login-card panel">
        <div className="login-brand">
          <div className="brand-mark">
            <Boxes size={22} />
          </div>
          <div>
            <strong>Stockroom</strong>
            <span>QUẢN LÝ KHO HÀNG</span>
          </div>
        </div>

        <div className="login-header">
          <div className="eyebrow">CỔNG QUẢN TRỊ</div>
          <h1>Đăng nhập hệ thống</h1>
          <p>Nhập thông tin tài khoản quản trị viên để truy cập không gian vận hành kho.</p>
        </div>

        {error && <Notice message={error} kind="error" />}

        <form className="form-stack" onSubmit={(event) => void handleSubmit(event)}>
          <Field label="Tên đăng nhập">
            <input
              required
              autoFocus
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Ví dụ: admin"
              autoComplete="username"
            />
          </Field>
          <Field label="Mật khẩu">
            <input
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </Field>
          <button className="button button-primary login-submit" type="submit" disabled={loading}>
            <LogIn size={16} />
            {loading ? 'Đang xác thực...' : 'Đăng nhập'}
          </button>
        </form>

        <div className="login-hint">
          <ShieldCheck size={16} />
          <div>
            <strong>Tài khoản mặc định:</strong> <code>admin</code> / <code>admin123</code>
          </div>
        </div>
      </div>
    </div>
  )
}
