import { Injectable } from '@angular/core';

import { Observable } from 'rxjs';

import { PersistenceProvider, SignalIdValue } from '../types';
import { deserialize, serialize } from 'ngx-simple-serializer';


@Injectable({ providedIn: 'root' })
export class LocalStoragePersistence implements PersistenceProvider {
  initialize(lookupIds: Iterable<string>): Observable<SignalIdValue> {
    const ids = [...lookupIds];
    return new Observable(subscriber => {
      ids.forEach(id => {
        const serializedValue = localStorage.getItem(id);
        if (serializedValue) {
          subscriber.next({ id, value: deserialize(serializedValue) });
        }
      });
      subscriber.complete();
    });
  }

  persistValue(idValue: SignalIdValue) {
    localStorage.setItem(idValue.id, serialize(idValue.value));
  }
}

@Injectable({ providedIn: 'root' })
export class SessionStoragePersistence implements PersistenceProvider {
  initialize(lookupIds: Iterable<string>): Observable<SignalIdValue> {
    const ids = [...lookupIds];
    return new Observable(subscriber => {
      ids.forEach(id => {
        const serializedValue = sessionStorage.getItem(id);
        if (serializedValue) {
          subscriber.next({ id, value: deserialize(serializedValue) });
        }
      });
      subscriber.complete();
    });
  }

  persistValue(idValue: SignalIdValue) {
    sessionStorage.setItem(idValue.id, serialize(idValue.value));
  }
}
