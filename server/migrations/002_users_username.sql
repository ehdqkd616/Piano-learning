-- 회원가입을 이메일 대신 아이디로 받는다. 기존 계정 값은 그대로 둔다 (예전 이메일이 곧 아이디).
ALTER TABLE users
  RENAME COLUMN email TO username,
  RENAME INDEX uq_users_email TO uq_users_username;
