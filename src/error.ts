import { DbError } from './core.js'
export { DbError, DbError as DBError } from './core.js'

export class DisconnectedError extends DbError {
  constructor(message?: string) {
    super(message ?? 'Disconnected')
  }
}

export class NotFoundError extends DbError {
  constructor(message?: string) {
    super(message ?? 'Not Found')
  }
}

export class ConflictError extends DbError {
  constructor(message?: string) {
    super(message ?? 'Conflict')
  }
}

export class TransactionError extends DbError {
  constructor(message?: string) {
    super(message ?? 'Transaction Error')
  }
}

export class UnacknowledgedError extends DbError {
  constructor(message?: string) {
    super(message ?? 'Unacknowledged')
  }
}
