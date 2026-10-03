const express = require('express')
const { pool } = require('../db')
const { requireAuth } = require('../auth')
const { serializeUser } = require('../serializers')

const router = express.Router()
router.use(requireAuth)

const MAX_NICKNAME = 50   // users.nickname VARCHAR(50)

// 앱의 UserSettings 타입과 맞춘 설정 키별 검사. 여기 없는 키는 받지 않는다.
const SETTING_VALIDATORS = {
  inputMode: (v) => ['midi', 'mic', 'virtual'].includes(v),
  bpm: (v) => Number.isInteger(v) && v >= 20 && v <= 300,
  viewMode: (v) => ['falling', 'sheet', 'hybrid'].includes(v),
  handSplit: (v) => ['both', 'left', 'right'].includes(v),
  midiDeviceId: (v) => typeof v === 'string' && v.length <= 200,
  micSensitivity: (v) => typeof v === 'number' && v >= 0 && v <= 1,
  timingTolerance: (v) => Number.isInteger(v) && v >= 10 && v <= 1000,
}

function validateSettings(settings) {
  if (typeof settings !== 'object' || settings === null || Array.isArray(settings)) return '설정 형식이 올바르지 않습니다.'
  for (const [key, value] of Object.entries(settings)) {
    const validate = SETTING_VALIDATORS[key]
    if (!validate) return `알 수 없는 설정입니다: ${key}`
    if (!validate(value)) return `설정 값이 올바르지 않습니다: ${key}`
  }
  return null
}

router.patch('/', async (req, res) => {
  const { nickname, settings } = req.body ?? {}
  if (nickname !== undefined && (typeof nickname !== 'string' || nickname.trim().length > MAX_NICKNAME)) {
    return res.status(400).json({ error: `닉네임은 ${MAX_NICKNAME}자 이하의 문자열이어야 합니다.` })
  }
  if (settings !== undefined) {
    const error = validateSettings(settings)
    if (error) return res.status(400).json({ error })
  }

  const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [req.userId])
  const current = rows[0]
  if (!current) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' })

  // JSON 컬럼은 mysql2가 객체로 파싱해서 돌려준다
  const nextNickname = typeof nickname === 'string' && nickname.trim() ? nickname.trim() : current.nickname
  const nextSettings = settings ? { ...current.settings, ...settings } : current.settings

  await pool.execute('UPDATE users SET nickname = ?, settings = ? WHERE id = ?',
    [nextNickname, JSON.stringify(nextSettings), req.userId])

  const [updated] = await pool.execute('SELECT * FROM users WHERE id = ?', [req.userId])
  res.json({ user: serializeUser(updated[0]) })
})

module.exports = router
