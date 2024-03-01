import { Type } from '@angular/core';
import { Observable } from 'rxjs';

export type SignalIdValue = { id: string, value: any };

export type PersistedSignalOptions = { id: string, persistenceProvider?: Type<PersistenceProvider>}

export interface PersistenceProvider {
  /**
   * The SignalBucket calls this method once to retrieve the currently persisted values of the associated signals, if they exist.
   * 
   * It should return only the values of the passed ids that have been persisted.
   */
  initialize(ids: Iterable<string>): Observable<SignalIdValue>;

  /**
   * Persist updated signal value.
   * 
   * If this method exists, the signalBucket calls this method each time the value of a persisted Signal changes.
   * - the SignalBucket updates the associated signal immediately if the method does not return anything
   * - the SignalBucket updatess the associated signal after the Observable returns the persisted serialized value
   */
  persistValue?(value: SignalIdValue): Observable<string> | void;

  /**
   * Receive associated signal values from an external source (e.g. a websocket).
   * 
   * If this Observable exists, the SignalBucket updates any associated signal values received from this observable
   */
  receiveSignal$?: Observable<SignalIdValue>;

  /**
   * Send updated Signal values to an external destination (e.g. a websocket)
   * 
   * If this method exists, the signalBucket calls this method each time the value of a persisted Signal changes
   * - the signalBucket does not change the value of the associated signal
   */
  sendSignal?(idValue: SignalIdValue): void;
}