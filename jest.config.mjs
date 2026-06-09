/** @type {import('jest').Config} */
const config = {
  roots: ['<rootDir>/dist'],
  testMatch: ['<rootDir>/dist/jest/**/?(*.)+(spec|test).[tj]s?(x)'],
}
export default config
