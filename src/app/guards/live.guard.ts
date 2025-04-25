import { CanDeactivateFn } from '@angular/router';

export const canDeactivateLiveGuard: CanDeactivateFn<any> = (
  component,
  currentRoute,
  currentState,
  nextState
) => {
  if (nextState?.url?.includes('live')) {
    return true;
  }
  if (
    confirm(
      'Are you sure you want to leave this page? Unsaved changes may be lost.'
    )
  ) {
    if (currentRoute.url[0].path === 'live') {
      component.liveMatchService.exitMatch('');
    }
    return true;
  } else {
    return false;
  }
};
