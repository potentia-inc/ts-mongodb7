// Opt-in: apply every prototype patch at once. Prefer importing only what you
// need — a single type (`./patch/decimal128`) or a single patch
// (`./patch/decimal128/json`).
//
//   import '@potentia/mongodb7/patch'
import './binary/index.js'
import './decimal128/index.js'
import './objectid/index.js'
import './uuid/index.js'
