import { HttpClient } from '@angular/common/http';
import { Injectable, OnDestroy } from '@angular/core';

import { Observable, switchMap, from, Subject, map, mergeMap, tap, Subscription } from 'rxjs';
import { webSocket } from 'rxjs/webSocket';

import { PersistenceProvider, SerializedSignal } from './types';


// example for persistence on an external server
@Injectable({ providedIn: 'root' })
export class ServerPersistence implements PersistenceProvider {
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

type WebSocketResult = {
  type: string,
  content: any,
}

// example for a persistence provider using a websocket to store and retrieve updates
@Injectable({ providedIn: 'root' })
export class WebSocketPersistence implements PersistenceProvider, OnDestroy {
  private webSocket = webSocket<WebSocketResult>('wss://websocket.url');
  private subscription: Subscription;

  getIdValuesUrl = 'https://get.persisted.values.of.supplied.ids.url';

  constructor(
    protected httpClient: HttpClient
  ) {
    this.subscription = this.sendSignal$.subscribe(serializedSignal => this.webSocket.next({ type: 'persistedSignal', content: serializedSignal }));
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  initialize(ids: Iterable<string>): Observable<SerializedSignal> {
    return this.httpClient.post<SerializedSignal[]>(this.getIdValuesUrl, [...ids]).pipe(
      switchMap(results => from(results))
      // TODO: handle errors
    );
  }

  sendSignal$ = new Subject<SerializedSignal>;

  receiveSignal$ = this.webSocket.multiplex(
    () => ({ subscribe: 'persistedSignal' }),
    () => ({ unsubscribe: 'persistedSignal' }),
    (message: any) => message.type === 'persistedSignal'
  ).pipe(
    map(message => message.content as SerializedSignal)
  );
}