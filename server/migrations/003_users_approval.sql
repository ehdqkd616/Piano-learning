-- 가입 승인제·관리자 (모든 프로젝트 공통 회원 규칙)
-- 기존 회원은 승인된 일반 회원으로 두고, 이후 가입자부터 승인 대기(pending)로 받는다.
ALTER TABLE users
  ADD COLUMN role          VARCHAR(20)  NOT NULL DEFAULT 'user'     AFTER nickname,
  ADD COLUMN status        VARCHAR(20)  NOT NULL DEFAULT 'approved' AFTER role,
  ADD COLUMN signup_note   TEXT         NULL                        AFTER status,
  ADD COLUMN reject_reason VARCHAR(500) NULL                        AFTER signup_note,
  ADD COLUMN approved_at   DATETIME(3)  NULL,
  ADD COLUMN last_login_at DATETIME(3)  NULL,
  ADD COLUMN password_changed_at DATETIME(3) NULL,  -- 이 시각 이전에 발급한 토큰은 무효
  ADD INDEX idx_users_status (status);

ALTER TABLE users ALTER COLUMN status SET DEFAULT 'pending';

-- 가입·로그인·관리자 조치 기록
CREATE TABLE audit_log (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_id    CHAR(36)        NULL,
  action      VARCHAR(50)     NOT NULL,
  target_id   CHAR(36)        NULL,
  detail      JSON            NULL,
  ip          VARCHAR(64)     NULL,
  created_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_audit_created (created_at)
) ENGINE=InnoDB;
