# ngx-signal-buckets

A lightweight implementation for Signal persistance in [Angular](https://angular.dev/).

This library may be useful if you want to persist Signal values between sessions, but don't want the complexity of a store like [ngrx](https://ngrx.io/).

It defaults to persisting Signals to localStorage and  has built-in support for sessionStorage. You can also write your own persistence provider in a few lines of code by implementing the SignalProvider interface. It supports both synchronous and asynchronous persistence.

For the latest changes and the current version see the [Change log](./CHANGELOG.md).

Just create a service that extends the SignalBucket class and add your own properties and initialize them with the `persistedSignal()` method like in the example below. You need to call the `initialize()` method once to retrieve previously persisted values, e.g. after a successful login.
## example

``` typescript
// Example of a signal bucket that persists to localStorage unless specified otherwise
@Injectable({ providedIn: 'root' })
class MySignals extends SignalBucket {
  // list of persisted signals is defined and initialized here
  property1 = this.persistedSignal('initialValue', 'id');
  property2 = this.persistedSignal(new SerializableClass(), {
    id: 'id2',
    persistence: SessionStoragePersistence
  });
  property3 = this.persistedSignal(new SerializableClass(), { id: 'id3' });
  // etc...
  propertyN = this.persistedSignal([] as PropertyArray, 'idN')
}


// Example of how to make sure all persisted signal values in the bucket are restored before proceding
// e.g. after the user has logged in, we want to retrieve the persisted state before we continue
class LoginPageComponent {
  userSignals = inject(UserSignalBucket);

  passwordSubmit() {
    if(password.isCorrect()) {
      userSignals.initialize(() => navigateToMainPage());
    }
  }
}

```

## SignalBucket

The `SignalBucket` class is the parent class for the service(s) with Signals that need to be persisted.

Create a service that extends the SignalBucket class and add your own properties and initialize them with the `persistedSignal()` method like in the example below. You need to call the `initialize()` method once to retrieve previously persisted values, e.g. after a successful login.

The persistedSignal() method takes 2 parameters:
  - `persistedSignal(initialValue: any, id: string)`
    -  `initialValue`: the initial value of the Signal
    -  `id`: the id that identifies the value of the persisted signal for the persistence provider
  - `persistedSignal(initialValue: any, options: PersistedSignalOptions)`
    -  `initialValue`: the initial value of the Signal 
    -  `options`: `{ id: string, persistence?: Type<PersistenceProvider> }`
       -  `id`: the id that identifies the value of the persisted signal for the persistence provider
       -  `persistence`: the persistence provider class used for this persistent signal

``` typescript
@Injectable({ providedIn: 'root' })
class MySignals extends SignalBucket {
  // list of persisted signals is defined and initialized here
  property1 = this.persistedSignal('initialValue', 'id');
  property2 = this.persistedSignal(new SerializableClass(), {
    id: 'id2',
    persistence: SessionStoragePersistence
  });
  property3 = this.persistedSignal(new SerializableClass(), { id: 'id3' });
  // etc...
  propertyN = this.persistedSignal([] as PropertyArray, 'idN')
}
```

By default the persistence provider for the signals inside the Service that are defined with the `persistedSignal` method is `LocalStoragePersistence`. You can override the default persistence as follows:

``` typescript
class MySignals extends SignalBucket {
  override defaultPersistence = MyCustomPersistence;

  //... define public signal properties
}
```

You need to call the `initialize()` method once to retrieve previously persisted values, e.g. after a successful login.

``` typescript
// Example of how to make sure all persisted signal values in the bucket are restored before proceding
// e.g. after the user has logged in, we want to retrieve the persisted state before we continue
class LoginPageComponent {
  userSignals = inject(UserSignalBucket);

  passwordSubmit() {
    if(password.isCorrect()) {
      userSignals.initialize(() => navigateToMainPage());
    }
  }
}
```


## PersistenceProvider

The `PersistenceProvider` interface defines a persistence provider. Several types of persistence providers are supported:
- update signal value directly with `set(value)` or `update(value => newValue)`, it will not wait until persistence has completed
- update the signal value after persistence has completed
- do not (directly) update the signal value with `set(value)` or `update(value => newValue)`, but use  `sendSignal$` Subject and `receiveSignal$` Observable in the `PersistenceProvider` for that (e.g. when using a `webSocket` to update and receive new Signal values).

The supplied `LocalStoragePersistence` and `SessionStoragePersistence` use the [`ngx-simple-serializer`](https://www.npmjs.com/package/ngx-simple-serializer) library to persist and restore values. You can use this in your own custom persistence provider like in the examples below or use your own method.

### Example that persists to and from a server API

The server api call returns the stored value (which can differ from the posted value), and returns it in an Observable so the SignalBucket can update the Signal to that value. 
``` typescript

// Small example of how to write a custom PersistenceProvider for your persistedSignals
// so you can persist values to a server
@Injectable({ providedIn: 'root' })
export class ServerPersistence implements PersistenceProvider {
  constructor(
    protected httpClient: HttpClient
  ) { }

  initialize(ids: Iterable<string>): Observable<SignalIdValue> {
    return this.httpClient.post<string[]>('retrieve.initial.persisted.id.values.url', [...ids]).pipe(
      switchMap(results => from(results)),
      map(serializedIdValue => deserialize(serializedIdValue))
      // TODO: handle errors
    );
  }

  persistValue(idValue: SignalIdValue) {
    return this.httpClient.post<string>('persist.id.value.url', serialize(idValue)).pipe(
      // TODO: handle errors
    );
  }
}
```

### Example that persists to and from a websocket

The persistence provider passes updated values on to the websocket and receives updated values from the websocket.

``` typescript
// example for a persistence provider using a websocket to store and retrieve updates
@Injectable({ providedIn: 'root' })
export class WebSocketPersistence implements PersistenceProvider, OnDestroy {
  private subscription: Subscription;

  private webSocket = webSocket<WebSocketResult>({
    url: 'wss://websocket.url',
    serializer: serialize,
    deserializer: deserialize as () => WebSocketResult,
    openObserver: { next: () => this.authenticate() }
  });

  private authenticate() {
    this.webSocket.next({ 
      type: 'authentication', 
      content: 'authentication credentials (bearer token, username/password etc.)' 
    });
  }

  constructor() {
    this.subscription = this.sendSignal$.subscribe(idValue => this.webSocket.next({
      type: 'persistedSignal', 
      content: idValue
    }));
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  initialize(ids: Iterable<string>): Observable<any> {
    return this.webSocket.multiplex(
      () => ({ call: 'initializePersistedSignal', ids }),
      () => undefined,
      (message: any) => message.type === 'initializePersistedSignalResult'
    ).pipe(
      first(),
      mergeMap(message => from(message.content as SignalIdValue[])),
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
```