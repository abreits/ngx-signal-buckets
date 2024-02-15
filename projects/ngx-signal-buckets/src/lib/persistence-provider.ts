import { Injectable } from '@angular/core';

import { Observable } from 'rxjs';

import { PersistenceProvider, SerializedSignal } from './types';


@Injectable({ providedIn: 'root' })
export class LocalStoragePersistence implements PersistenceProvider {
  initialize(lookupIds: Iterable<string>): Observable<SerializedSignal> {
    const ids = [...lookupIds];
    return new Observable(subscriber => {
      ids.forEach(id => {
        const serializedValue = localStorage.getItem(id);
        if (serializedValue) {
          subscriber.next({ id, serializedValue });
        }
      });
      subscriber.complete();
    });
  }

  persistValue(value: SerializedSignal) {
    localStorage.setItem(value.id, value.serializedValue);
  }
}

@Injectable({ providedIn: 'root' })
export class SessionStoragePersistence implements PersistenceProvider {
  initialize(lookupIds: Iterable<string>): Observable<SerializedSignal> {
    const ids = [...lookupIds];
    return new Observable(subscriber => {
      ids.forEach(id => {
        const serializedValue = sessionStorage.getItem(id);
        if (serializedValue) {
          subscriber.next({ id, serializedValue });
        }
      });
      subscriber.complete();
    });
  }

  persistValue(value: SerializedSignal) {
    sessionStorage.setItem(value.id, value.serializedValue);
  }
}
