import { defineConfig } from 'vitest/config'

// 테스트는 개발 DB가 아니라 piano_learning_test를 쓴다 (docker/mysql-init/01-test-db.sql)
export default defineConfig({
  test: {
    env: {
      DB_HOST: process.env.TEST_DB_HOST ?? '127.0.0.1',
      DB_PORT: process.env.TEST_DB_PORT ?? '3306',
      DB_USER: process.env.TEST_DB_USER ?? 'piano',
      DB_PASSWORD: process.env.TEST_DB_PASSWORD ?? 'pianopass',
      DB_NAME: 'piano_learning_test',
      JWT_SECRET: 'test-secret',
    },
    globalSetup: './test/globalSetup.js',
    // 같은 DB를 쓰므로 테스트 파일을 순서대로 실행한다
    fileParallelism: false,
  },
})
