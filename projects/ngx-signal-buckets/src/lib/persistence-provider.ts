import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { Observable, from, switchMap } from 'rxjs';

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

// example for persistence on an external server
@Injectable({ providedIn: 'root' })
export class ServerPersistence implements PersistenceProvider {
  name = 'ServerPersist';
  getIdValuesUrl = 'https://get.persisted.values.of.supplied.ids.url';
  setValueUrl = 'https://persist.value.url';

  constructor(
    protected httpClient: HttpClient
  ) { }

  initialize(ids: Iterable<string>): Observable<SerializedSignal> {
    return this.httpClient.post<SerializedSignal[]>(this.getIdValuesUrl, [...ids]).pipe(
      switchMap(results => from(results))
      // TODO: handle errors
    );
  }

  persistValue(serializedSignal: SerializedSignal) {
    return this.httpClient.post<string>(this.setValueUrl, serializedSignal).pipe(
      // TODO: handle errors
    );
  }
}
