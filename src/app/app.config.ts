import { ApplicationConfig, ErrorHandler } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

import { routes } from './app.routes';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';
import { environment } from '../environments/environment';
import { logger } from './utils/logger';
import { GlobalErrorHandler } from './utils/global-error-handler';

// Initialize logger with environment config
logger.initialize(environment.isProdEnv);

const firebaseConfig = {
  apiKey: 'AIzaSyBLq32SteEldvV8zUCe2nD7rGUPEmfC_tA',
  authDomain: 'cricker-3b37d.firebaseapp.com',
  projectId: 'cricker-3b37d',
  storageBucket: 'cricker-3b37d.firebasestorage.app',
  messagingSenderId: '776618583257',
  appId: '1:776618583257:web:d38d5bc8ebf3f79dadcac8',
  measurementId: 'G-C1P4VYZWKD',
};

export const appConfig: ApplicationConfig = {
  providers: [
    // Without this, the router leaves the window's scroll position exactly
    // where it was on the previous page (e.g. scrolled partway down
    // allPlayers) - so navigating to a NEW route (player-details, match-
    // details, etc.) opened with that same scroll offset instead of at the
    // top, making it look like the page loaded "mid-scroll". 'top' resets
    // scroll on every route path change; 'enabled' still lets fragment/
    // anchor links (#some-id) work if ever used.
    provideRouter(
      routes,
      withInMemoryScrolling({
        scrollPositionRestoration: 'top',
        anchorScrolling: 'enabled',
      }),
    ),
    provideHttpClient(),
    provideAnimationsAsync(),
    provideFirebaseApp(() => initializeApp(firebaseConfig)),
    provideFirestore(() => getFirestore()),
    // Global error handler for logging errors to Axiom
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
  ],
};
