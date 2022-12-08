import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        globals: true,
        include: ['./test/**/*.test.ts'],
        testTimeout: 15000,
        coverage: {
            provider: 'c8'
        }
    },
})
