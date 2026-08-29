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
    console.error('Global error caught:', error);

    // Extract error details
    const errorMessage = error?.message || 'Unknown error occurred';
    const errorStack = error?.stack || '';
    const errorName = error?.name || 'UnknownError';

    // Log to Axiom
    logger
      .error(errorMessage, {
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
