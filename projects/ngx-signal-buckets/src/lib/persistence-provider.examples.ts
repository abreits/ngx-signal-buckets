import { HttpClient } from '@angular/common/http';
import { Injectable, OnDestroy } from '@angular/core';

import { Observable, switchMap, from, Subject, map, Subscription, first, mergeMap } from 'rxjs';
import { webSocket } from 'rxjs/webSocket';

import { PersistenceProvider, SignalIdValue } from './types';
import { deserialize, serialize } from 'ngx-simple-serializer';


// example for persistence on an external server
@Injectable({ providedIn: 'root' })
export class ServerPersistence implements PersistenceProvider {
  getIdValuesUrl = 'https://get.persisted.values.of.supplied.ids.url';
  setValueUrl = 'https://persist.value.url';

  constructor(
    protected httpClient: HttpClient
  ) { }

  initialize(ids: Iterable<string>): Observable<SignalIdValue> {
    return this.httpClient.post<string[]>(this.getIdValuesUrl, [...ids]).pipe(
      switchMap(results => from(results)),
      map(serializedIdValue => deserialize(serializedIdValue))
      // TODO: handle errors
    );
  }

  persistValue(idValue: SignalIdValue) {
    return this.httpClient.post<string>(this.setValueUrl, serialize(idValue)).pipe(
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
  private webSocket = webSocket<WebSocketResult>({
    url: 'wss://websocket.url',
    serializer: serialize,
    deserializer: deserialize as () => WebSocketResult,
    openObserver: { next: () => this.authenticate() }
  });

  private authenticate() {
    this.webSocket.next({ type: 'authentication', content: 'authentication credentials (bearer token, username/password etc.)' });
  }

  private subscription: Subscription;

  constructor(
    protected httpClient: HttpClient
  ) {
    this.subscription = this.sendSignal$.subscribe(serializedSignal => this.webSocket.next({ type: 'persistedSignal', content: serializedSignal }));
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  initialize(ids: Iterable<string>): Observable<SignalIdValue> {
    return this.webSocket.multiplex(
      () => ({ call: 'initializePersistedSignal', ids }),
      () => undefined,
      (message: any) => message.type === 'initializePersistedSignalResult'
    ).pipe(
      first(),
      mergeMap(message => from(message.content as SignalIdValue[]))
    );
  }

  sendSignal$ = new Subject<SignalIdValue>;

  receiveSignal$ = this.webSocket.multiplex(
    () => ({ subscribe: 'persistedSignal' }),
    () => ({ unsubscribe: 'persistedSignal' }),
    (message: any) => message.type === 'persistedSignal'
  ).pipe(
    map(message => message.content as SignalIdValue)
  );
}