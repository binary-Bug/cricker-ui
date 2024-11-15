import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';

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
    provideRouter(routes),
    provideAnimationsAsync(),
    provideFirebaseApp(() => initializeApp(firebaseConfig)),
    provideFirestore(() => getFirestore()),
  ],
};
