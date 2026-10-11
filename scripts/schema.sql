CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'organizer',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS players (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  nickname VARCHAR(100),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS tournaments (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  date VARCHAR(10) NOT NULL,
  location VARCHAR(150),
  type VARCHAR(10) NOT NULL,
  format TINYINT NOT NULL DEFAULT 1,
  status VARCHAR(12) NOT NULL DEFAULT 'LIVE',
  champion_team_id VARCHAR(36),
  runner_up_team_id VARCHAR(36),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS teams (
  id VARCHAR(36) PRIMARY KEY,
  tournament_id VARCHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  player1_id VARCHAR(36) NOT NULL,
  player2_id VARCHAR(36) NOT NULL,
  INDEX (tournament_id)
);
CREATE TABLE IF NOT EXISTS matches (
  id VARCHAR(36) PRIMARY KEY,
  tournament_id VARCHAR(36) NOT NULL,
  kind VARCHAR(20) NOT NULL,
  round INT NOT NULL DEFAULT 1,
  round_name VARCHAR(40),
  slot_index INT NOT NULL DEFAULT 0,
  team_a_id VARCHAR(36),
  team_b_id VARCHAR(36),
  winner_team_id VARCHAR(36),
  status VARCHAR(12) NOT NULL DEFAULT 'UPCOMING',
  play_order INT NOT NULL DEFAULT 0,
  feeds_into_match_id VARCHAR(36),
  feeds_slot CHAR(1),
  format TINYINT NOT NULL DEFAULT 1,
  toss_json TEXT,
  initial_json TEXT,
  actions_json MEDIUMTEXT,
  state_json TEXT,
  seq INT NOT NULL DEFAULT 0,
  games_json TEXT,
  score_a_total INT DEFAULT 0,
  score_b_total INT DEFAULT 0,
  started_at DATETIME,
  completed_at DATETIME,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX (tournament_id)
);
CREATE TABLE IF NOT EXISTS match_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  match_id VARCHAR(36) NOT NULL,
  seq INT NOT NULL,
  action_json TEXT NOT NULL,
  state_json TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX (match_id, seq)
);
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(36),
  action VARCHAR(60) NOT NULL,
  entity_id VARCHAR(36),
  detail TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS app_setup (
  id TINYINT PRIMARY KEY,
  admin_user_id VARCHAR(36) NOT NULL,
  completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CHECK (id = 1)
);
ALTER TABLE matches MODIFY kind VARCHAR(20) NOT NULL;
INSERT IGNORE INTO app_setup (id, admin_user_id) SELECT 1, id FROM users ORDER BY created_at LIMIT 1;
UPDATE matches SET kind='LEAGUE_FINAL' WHERE kind='FINAL'
