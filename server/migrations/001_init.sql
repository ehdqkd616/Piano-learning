-- 001: 초기 스키마 (SQLite 버전 스키마를 MySQL 8로 옮기면서 타입·제약조건 정리)
-- 이미 적용된 마이그레이션 파일은 수정하지 않는다. 스키마 변경은 002_*.sql처럼 새 파일로 추가한다.

CREATE TABLE users (
  id                 CHAR(36)         NOT NULL,
  email              VARCHAR(255)     NOT NULL,
  password_hash      VARCHAR(100)     NOT NULL,
  nickname           VARCHAR(50)      NOT NULL,
  level              INT UNSIGNED     NOT NULL DEFAULT 1,
  total_xp           INT UNSIGNED     NOT NULL DEFAULT 0,
  streak             INT UNSIGNED     NOT NULL DEFAULT 0,
  last_practice_date DATE             NULL,          -- 연습한 적 없으면 NULL (SQLite 버전의 '' 대신)
  settings           JSON             NOT NULL,
  created_at         DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

-- 곡 카탈로그는 서버 부팅 시 seedSongs.js 내용으로 upsert된다.
-- 연습 기록이 곡을 FK로 참조하므로, 카탈로그에서 빠진 곡은 지우지 않고 is_active = 0으로 숨긴다.
CREATE TABLE songs (
  song_id        VARCHAR(50)       NOT NULL,
  title          VARCHAR(200)      NOT NULL,
  artist         VARCHAR(200)      NOT NULL,
  genre          VARCHAR(50)       NOT NULL,
  difficulty     TINYINT UNSIGNED  NOT NULL,
  duration_ms    INT UNSIGNED      NOT NULL,
  bpm            SMALLINT UNSIGNED NOT NULL,
  key_signature  VARCHAR(10)       NOT NULL,
  time_signature VARCHAR(10)       NOT NULL,
  midi_data      MEDIUMTEXT        NULL,
  music_xml      MEDIUMTEXT        NULL,
  audio_preview  VARCHAR(500)      NULL,
  tags           JSON              NOT NULL,
  notes          JSON              NOT NULL,       -- [{ noteNumber, beats }] 곡과 함께만 읽으므로 JSON으로 둔다
  is_active      TINYINT(1)        NOT NULL DEFAULT 1,
  PRIMARY KEY (song_id),
  KEY idx_songs_active (is_active)
) ENGINE=InnoDB;

CREATE TABLE favorites (
  user_id    CHAR(36)    NOT NULL,
  song_id    VARCHAR(50) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, song_id),
  CONSTRAINT fk_favorites_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_favorites_song FOREIGN KEY (song_id) REFERENCES songs (song_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE sessions (
  session_id      CHAR(36)             NOT NULL,     -- 클라이언트가 만든 UUID
  user_id         CHAR(36)             NOT NULL,
  song_id         VARCHAR(50)          NOT NULL,
  started_at      DATETIME(3)          NOT NULL,     -- UTC
  ended_at        DATETIME(3)          NOT NULL,     -- UTC
  mode            ENUM('wait', 'play') NOT NULL,
  total_score     SMALLINT UNSIGNED    NOT NULL,
  pitch_accuracy  DECIMAL(5, 2)        NOT NULL DEFAULT 0,  -- 0.00 ~ 100.00
  timing_accuracy DECIMAL(5, 2)        NOT NULL DEFAULT 0,
  completion_rate DECIMAL(5, 2)        NOT NULL DEFAULT 0,
  PRIMARY KEY (session_id),
  -- 사용자별 기록을 최신순으로 조회하는 쿼리용 (user_id 단독 인덱스를 대체)
  KEY idx_sessions_user_started (user_id, started_at),
  KEY idx_sessions_song (song_id),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_sessions_song FOREIGN KEY (song_id) REFERENCES songs (song_id)
) ENGINE=InnoDB;

-- 음표별 판정 결과. SQLite 버전은 sessions.note_results에 JSON 문자열로 저장했지만,
-- "자주 틀리는 음" 같은 통계를 SQL로 뽑을 수 있도록 행 단위로 정규화한다.
CREATE TABLE session_note_results (
  session_id      CHAR(36)          NOT NULL,
  seq             SMALLINT UNSIGNED NOT NULL,      -- noteResults 배열 안의 순서
  note_index      SMALLINT UNSIGNED NOT NULL,      -- 악보상 음표 번호
  note_number     TINYINT UNSIGNED  NOT NULL,      -- MIDI 번호 0~127
  expected_time_ms INT              NOT NULL,
  actual_time_ms  INT               NOT NULL,
  timing_delta_ms INT               NOT NULL,
  verdict         ENUM('perfect', 'good', 'late', 'early', 'miss', 'skip') NOT NULL,
  PRIMARY KEY (session_id, seq),
  CONSTRAINT fk_note_results_session FOREIGN KEY (session_id) REFERENCES sessions (session_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE achievements (
  id          VARCHAR(50)  NOT NULL,
  user_id     CHAR(36)     NOT NULL,
  title       VARCHAR(100) NOT NULL,
  description VARCHAR(255) NOT NULL,
  icon        VARCHAR(50)  NOT NULL,
  unlocked_at DATETIME(3)  NULL,
  PRIMARY KEY (user_id, id),
  CONSTRAINT fk_achievements_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;
