-- 테스트 전용 DB. 볼륨을 새로 만들 때 MySQL 컨테이너가 한 번 실행한다.
-- 이미 있는 볼륨에는 수동으로 실행: docker compose exec -T mysql mysql -uroot -prootpass < docker/mysql-init/01-test-db.sql
CREATE DATABASE IF NOT EXISTS piano_learning_test CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
GRANT ALL PRIVILEGES ON piano_learning_test.* TO 'piano'@'%';
