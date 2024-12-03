import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class EventHandlerService {
  constructor() {}

  // Run Added Event
  private _runAddedSubj = new Subject<void>();
  RunAddedEvent$(): Observable<any> {
    return this._runAddedSubj.asObservable();
  }
  NotifyRunAddedEvent(): void {
    this._runAddedSubj.next();
  }

  // Batsmen Swap Event
  private _batsmenSwapSubj = new Subject<void>();
  BatsmenSwapEvent$(): Observable<any> {
    return this._batsmenSwapSubj.asObservable();
  }
  NotifyBatsmenSwappedEvent(): void {
    this._batsmenSwapSubj.next();
  }

  // Undo Event
  NotifyUndoEvent(): void {
    this._runAddedSubj.next();
  }

  // Extras Checked Event
  private _updateOverViewGridSubj = new Subject<boolean>();
  UpdateOverViewGridEvent$(): Observable<any> {
    return this._updateOverViewGridSubj.asObservable();
  }
  NotifyUpdateOverViewGridEvent(isRemove: boolean): void {
    this._updateOverViewGridSubj.next(isRemove);
  }

  // Update On-Field Batsmen Event
  private _updateOnFieldBatsmenSubj = new Subject<void>();
  UpdateOnFieldBatsmenEvent$(): Observable<any> {
    return this._updateOnFieldBatsmenSubj.asObservable();
  }
  NotifyUpdateOnFieldBatsmenEvent(): void {
    this._updateOnFieldBatsmenSubj.next();
  }
}
