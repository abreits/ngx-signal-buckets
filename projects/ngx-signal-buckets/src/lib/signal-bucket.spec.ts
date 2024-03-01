import { Injectable } from '@angular/core';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';

import { Observable, Subject, delay, map, merge, of } from 'rxjs';

import { SignalBucket } from './signal-bucket';
import { LocalStoragePersistence } from './persistence-providers/web-storage';
import { PersistenceProvider, SignalIdValue } from './types';
import { serialize } from 'ngx-simple-serializer';

@Injectable({ providedIn: 'root' })
class AsyncInitializeLocalStoragePersistence extends LocalStoragePersistence {
  // async initialize
  override initialize(lookupIds: Iterable<string>): Observable<SignalIdValue> {
    return super.initialize(lookupIds).pipe(
      delay(1)
    );
  }
}

@Injectable({ providedIn: 'root' })
class AsyncPersistValueLocalStoragePersistence extends LocalStoragePersistence {
  // async initialize
  override persistValue(idValuePair: SignalIdValue) {
    return of(idValuePair).pipe(
      delay(1),
      map(idValuePair => {
        const value = (idValuePair.value as string) + 'Modified';
        localStorage.setItem(idValuePair.id, serialize(value));
        return value;
      })
    );
  }
}

@Injectable({ providedIn: 'root' })
class EmptyStoragePersistence implements PersistenceProvider {
  initialize() {
    return of();
  }
}

@Injectable({ providedIn: 'root' })
class ErrorStoragePersistence implements PersistenceProvider {
  initialize() {
    return new Observable(() => {
      throw new Error('persistenceProvider initialize error');
    }) as any;
  }
}

@Injectable({ providedIn: 'root' })
class EmptySignalBucket extends SignalBucket {
  protected override defaultPersistence = EmptyStoragePersistence;
  property1 = this.persistedSignal('initialValue', 'property1Id');
}

@Injectable({ providedIn: 'root' })
class SyncSignalBucket extends SignalBucket {
  property1 = this.persistedSignal('initialValue', 'property1Id');
}

@Injectable({ providedIn: 'root' })
class ErrorSignalBucket extends SignalBucket {
  protected override defaultPersistence = ErrorStoragePersistence;
  property1 = this.persistedSignal('initialValue', 'property1Id');
}

@Injectable({ providedIn: 'root' })
class SyncAsyncSignalBucket extends SignalBucket {
  property1 = this.persistedSignal('initialValue', 'property1Id');
  property2 = this.persistedSignal('initialValue2', {
    id: 'property2Id',
    persistenceProvider: AsyncInitializeLocalStoragePersistence
  });
  property3 = this.persistedSignal('initialValue3', 'property3Id');
}

@Injectable({ providedIn: 'root' })
class DuplicateIdSignalBucket extends SignalBucket {
  property1 = this.persistedSignal('initialValue', 'property1Id');
  property1too = this.persistedSignal('initialValue', 'property1Id');
}

@Injectable({ providedIn: 'root' })
class AsyncPersistValueSignalBucket extends SignalBucket {
  override defaultPersistence = AsyncPersistValueLocalStoragePersistence;
  property1 = this.persistedSignal('initialValue', 'property1Id');
}

describe('SignalBucket', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    const service = TestBed.inject(SyncSignalBucket);
    expect(service).toBeTruthy();
  });

  describe('initialize()', () => {
    it('should keep the value of a persistedSignal when no persisted value is available', (done) => {
      const service = TestBed.inject(SyncSignalBucket);
      expect(service.property1()).toBe('initialValue');

      service.initialize(() => {
        expect(service.property1()).toBe('initialValue');
        done();
      });
    });

    it('should not return a value if called with parameters', () => {
      const service = TestBed.inject(SyncSignalBucket);
      expect(service.property1()).toBe('initialValue');

      expect(service.initialize(() => { })).toBeUndefined();
    });

    it('should return an observable if called without parameters', () => {
      const service = TestBed.inject(SyncSignalBucket);
      expect(service.property1()).toBe('initialValue');

      const observable = service.initialize();
      expect(observable instanceof Observable).toBeTrue();
    });

    it('should only initialize after subscribing to the returned observable', (done) => {
      const service = TestBed.inject(SyncSignalBucket);
      localStorage.setItem('property1Id', '"persistedValue"');

      const observable$ = service.initialize();
      expect(observable$ instanceof Observable).toBeTrue();
      expect(service.property1()).toBe('initialValue');
      observable$.subscribe({
        complete: () => {
          expect(service.property1()).toBe('persistedValue');
          done();
        }
      });
    });

    it('should be able to wait for completion of all initializations when initializing multiple SignalBuckets', (done) => {
      const service1 = TestBed.inject(SyncSignalBucket);
      localStorage.setItem('property1Id', '"persistedValue"');
      const service2 = TestBed.inject(SyncAsyncSignalBucket);
      localStorage.setItem('property1Id', '"persistedValue"');
      localStorage.setItem('property2Id', '"persistedValue2"');
      localStorage.setItem('property3Id', '"persistedValue3"');

      const observable$ = merge(service1.initialize(), service2.initialize());
      expect(observable$ instanceof Observable).toBeTrue();
      expect(service1.property1()).toBe('initialValue');
      expect(service2.property1()).toBe('initialValue');
      expect(service2.property2()).toBe('initialValue2');
      expect(service2.property3()).toBe('initialValue3');
      observable$.subscribe({
        complete: () => {
          expect(service1.property1()).toBe('persistedValue');
          expect(service2.property1()).toBe('persistedValue');
          expect(service2.property2()).toBe('persistedValue2');
          expect(service2.property3()).toBe('persistedValue3');          
          done();
        }
      });
    });

    it('should throw an error if called more than once', (done) => {
      const service = TestBed.inject(SyncSignalBucket);
      localStorage.setItem('property1Id', '"persistedValue"');

      service.initialize(() => {
        expect(() => service.initialize(() => { })).toThrowError('SignalBucket already initialized, initialize should only be called once');
        done();
      });
    });

    it('should call the supplied complete() function after initialization is complete, sync PersistenceProviders', (done) => {
      const service = TestBed.inject(SyncSignalBucket);
      localStorage.setItem('property1Id', '"persistedValue"');

      service.initialize(() => {
        expect(service.property1()).toBe('persistedValue');
        done();
      });
    });

    it('should call the supplied complete() function after initialization is complete, sync PersistenceProviders', (done) => {
      const service = TestBed.inject(SyncSignalBucket);
      localStorage.setItem('property1Id', '"persistedValue"');

      service.initialize({
        complete: () => {
          expect(service.property1()).toBe('persistedValue');
          done();
        }
      });
    });

    it('should call the supplied complete() function after initialization is complete, sync and async PersistenceProviders', (done) => {
      const service = TestBed.inject(SyncAsyncSignalBucket);
      localStorage.setItem('property1Id', '"persistedValue"');
      localStorage.setItem('property2Id', '"persistedValue2"');
      localStorage.setItem('property3Id', '"persistedValue3"');
      expect(service.property1()).toBe('initialValue');
      expect(service.property2()).toBe('initialValue2');
      expect(service.property3()).toBe('initialValue3');

      service.initialize(() => {
        // expected all signal values to be updated after initialize completes
        expect(service.property1()).toBe('persistedValue');
        expect(service.property2()).toBe('persistedValue2');
        expect(service.property3()).toBe('persistedValue3');
        done();
      });
      // expect the sync signal values to be updated directly, the async not
      expect(service.property1()).toBe('persistedValue');
      expect(service.property2()).toBe('initialValue2');
      expect(service.property3()).toBe('persistedValue3');
    });

    it('should throw an error if the same property id is used multiple times', () => {
      expect(() => TestBed.inject(DuplicateIdSignalBucket)).toThrowError('SignalBucket contains duplicate persistedSignal id: property1Id');
    });

    it('should pass subscribe() errors', (done) => {
      const service = TestBed.inject(ErrorSignalBucket);
      localStorage.setItem('property1Id', '"persistedValue"');

      service.initialize({
        error: err => {
          expect(err).toEqual(new Error('persistenceProvider initialize error'));
          done();
        }
      });
    });
  });

  describe('persistedSignal signal value update policies depending on PersistenceProvider', () => {
    it('should update immediately if persistValue(...) does not return an observable', () => {
      const service = TestBed.inject(SyncSignalBucket);

      // test the set method of the signal
      service.property1.set('secondValue');
      expect(service.property1()).toBe('secondValue');
      expect(localStorage.getItem('property1Id')).toBe('"secondValue"');

      //also test the update method of the signal
      service.property1.update(currentValue => currentValue + 'Updated');
      expect(service.property1()).toBe('secondValueUpdated');
      expect(localStorage.getItem('property1Id')).toBe('"secondValueUpdated"');
    });

    it('should update to the value returned by the observable if persistValue(...) returns an observable', fakeAsync(() => {
      const service = TestBed.inject(AsyncPersistValueSignalBucket);

      service.property1.set('secondValue');
      expect(service.property1()).toBe('initialValue');

      tick(2);
      expect(service.property1()).toBe('secondValueModified');
      expect(localStorage.getItem('property1Id')).toBe('"secondValueModified"');
    }));

    it('should not update if persistValue(...) does not exist', () => {
      const service = TestBed.inject(EmptySignalBucket);

      service.property1.set('secondValue');
      expect(service.property1()).toBe('initialValue');
    });

    it('should send updates to sendSignal$ if it exists', () => {
      const persistenceProvider = TestBed.inject(EmptyStoragePersistence) as PersistenceProvider;
      persistenceProvider.sendSignal = serializedSignal => {
        expect(serializedSignal).toEqual({ id: 'property1Id', value: 'secondValue' });
      };

      const service = TestBed.inject(EmptySignalBucket);

      service.property1.set('secondValue');
      expect(service.property1()).toBe('initialValue');
    });

    it('should receive updates from receiveSignal$ if it exists', () => {
      const persistenceProvider = TestBed.inject(EmptyStoragePersistence) as PersistenceProvider;
      const receiveSignal$ = new Subject<SignalIdValue>();
      persistenceProvider.receiveSignal$ = receiveSignal$;

      const service = TestBed.inject(EmptySignalBucket);

      receiveSignal$.next({ id: 'property1Id', value: 'secondValue' });
      expect(service.property1()).toBe('secondValue');
    });
  });
});