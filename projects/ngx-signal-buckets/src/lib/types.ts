import { Type } from '@angular/core';
import { Observable, Subject } from 'rxjs';

export type SerializedSignal = { id: string, serializedValue: string };

export type persistedSignalOptions = { id: string, persistenceProvider?: Type<PersistenceProvider>}

export interface PersistenceProvider {
  /**
   * Return serialized values of the passed ids, if they were persisted, only needs to be called once.
   */
  initialize(ids: Iterable<string>): Observable<SerializedSignal>;

  /**
   * Persist updated serialized signal value
   * - update the signal immediately if the method does not return anything
   * - update the signal after the Observable returns the persisted serialized value
   */
  persistValue?(value: SerializedSignal): Observable<string> | void;

  /**
   * Receive serialized signal values from an external source (e.g. a websocket)
   */
  receiveSignal$?: Observable<SerializedSignal>;

  /**
   * Send updated serialized signal values to an external destination (e.g. a websocket)
   */
  sendSignal$?: Subject<SerializedSignal>;
}