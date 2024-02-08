# ngx-signal-buckets

A lightweight implementation for persistance in [Angular](https://angular.dev/).

This library may be useful if you want to persist values between sessions, but don't need the complexity that comes along with using a full store.

For the latest changes and the current version see the [Change log](./CHANGELOG.md).

## example

``` typescript
// Example of how to make sure all persisted signal values in the bucket are restored before proceding
// e.g. after the user has logged in, we want to retrieve the persisted state before we continue
class LoginComponent {
  userBucket = inject(UserSignalBucket);

  passwordSubmit() {
    if(password.isCorrect()) {
      userBucket.initialize(() => navigateToMainPage());
    }
  }
}


// Example of a signal bucket
@Injectable({ providedIn: 'root' })
class MySignalBucket extends SignalBucket {
  defaultPersistence = MyCystomPersistence; // optional, defaults to LocalStoragePersistence

  // list of persisted signals is defined and initialized here
  property1 = this.persistedSignal('initialValue', 'id');
  property2 = this.persistedSignal(new SerializableClass(), {
    id: 'id2',
    persistence: LocalStoragePersistence
  });
  property3 = this.persistedSignal(new SerializableClass(), { id: 'id3' });
  etc...
}

// Small example of how to persist values to a server
@Injectable({ providedIn: 'root' })
export class LocalStoragePersistence implements PersistenceProvider {
  initialize(ids: Iterable<string>): Observable<SerializedSignal> {
    return new Observable(subscriber => {
      for (const id in ids) {
        const serializedValue = localStorage.getItem(id);
        if (serializedValue) {
          subscriber.next({ id, serializedValue });
        }
      }
      subscriber.complete();
    });
  }

  persistValue(value: SerializedSignal) {
    localStorage.setItem(value.id, value.serializedValue);
  }
}
```

## documentation

The ngx-signal-buckets provide a simple solution to persist signal values with a minimum of overhead.

It works close together with the [ngx-simple-serializer](https://github.com/abreits/ngx-simple-serializer) for the serialization and deserialization of classes and values.

The signals inside of the signal buckets can also use an opinionated `update` method that internally uses [mutative](https://github.com/unadlib/mutative) to generate distinct updates.
