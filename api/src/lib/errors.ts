export type AppHttpStatus = 400 | 404 | 409 | 422 | 500

export class AppError extends Error {
  readonly status: AppHttpStatus
  readonly statusCode: AppHttpStatus

  constructor(message: string, status: AppHttpStatus = 500) {
    super(message)
    this.name = 'AppError'
    this.status = status
    this.statusCode = status
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(message, 404)
    this.name = 'NotFoundError'
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request') {
    super(message, 400)
    this.name = 'BadRequestError'
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(message = 'Unprocessable entity') {
    super(message, 422)
    this.name = 'UnprocessableEntityError'
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super(message, 409)
    this.name = 'ConflictError'
  }
}
