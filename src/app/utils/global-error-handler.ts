import { ErrorHandler, Injectable, Injector } from '@angular/core';
import { logger } from './logger';

/**
 * Global error handler that catches all Angular errors
 * and logs them to Axiom
 */
@Injectable({
  providedIn: 'root',
})
export class GlobalErrorHandler implements ErrorHandler {
  constructor(private injector: Injector) {}

  handleError(error: Error | any): void {
    // Extract error details
    const errorMessage = error?.message || 'Unknown error occurred';
    const errorStack =
      error?.stack ||
      new Error(errorMessage).stack ||
      'Stack trace unavailable';
    const errorName = error?.name || 'UnknownError';

    console.error(`Global error caught: ${errorMessage}\n${errorStack}`, error);

    // Log to Axiom
    logger
      .error(errorMessage, {
        event: 'angular_unhandled_error',
        errorName,
        errorStack,
        source: 'angular-global-handler',
      })
      .catch((err: any) => {
        console.error('Failed to log error to Axiom:', err);
      });

    // Re-throw to allow Angular to continue with its default handling
    // (which will still appear in browser console)
    // throw error;
  }
}
