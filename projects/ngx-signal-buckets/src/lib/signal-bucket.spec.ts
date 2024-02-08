import { Injectable } from '@angular/core';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';

import { Observable, delay, map, of } from 'rxjs';

import { SignalBucket } from './signal-bucket';
import { LocalStoragePersistence } from './persistence-provider';
import { PersistenceProvider, SerializedSignal } from './types';
import { deserialize, serialize } from 'ngx-simple-serializer';

@Injectable({ providedIn: 'root' })
class AsyncInitializeLocalStoragePersistence extends LocalStoragePersistence {
  // async initialize
  override initialize(lookupIds: Iterable<string>): Observable<SerializedSignal> {
    return super.initialize(lookupIds).pipe(
      delay(1)
    );
  }
}

@Injectable({ providedIn: 'root' })
class AsyncPersistValueLocalStoragePersistence extends LocalStoragePersistence {
  // async initialize
  override persistValue(idValuePair: SerializedSignal) {
    return of(idValuePair).pipe(
      delay(1),
      map(idValuePair => {
        const value = serialize((deserialize(idValuePair.serializedValue) as string) + 'Modified');
        localStorage.setItem(idValuePair.id, value);
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
class EmptySignalBucket extends SignalBucket {
  protected override defaultPersistance = EmptyStoragePersistence;
  property1 = this.persistedSignal('initialValue', 'property1Id');
}

@Injectable({ providedIn: 'root' })
class SyncSignalBucket extends SignalBucket {
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
  override defaultPersistance = AsyncPersistValueLocalStoragePersistence;
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
    it('should keep the value of a persistedSignal when no persisted value is available', () => {
      const service = TestBed.inject(SyncSignalBucket);
      expect(service.property1()).toBe('initialValue');

      service.initialize();
      expect(service.property1()).toBe('initialValue');
    });

    it('should change the value of a persistedSignal when a persisted value is available ', () => {
      const service = TestBed.inject(SyncSignalBucket);
      localStorage.setItem('property1Id', '"persistedValue"');

      service.initialize();
      expect(service.property1()).toBe('persistedValue');
    });

    it('should call the supplied complete() function after initialization is complete, sync PersistenceProviders', (done) => {
      const service = TestBed.inject(SyncSignalBucket);
      localStorage.setItem('property1Id', '"persistedValue"');

      service.initialize(() => {
        expect(service.property1()).toBe('persistedValue');
        done();
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
      expect(() => TestBed.inject(DuplicateIdSignalBucket)).toThrowError('SignalBucket contains duplicate signal id: property1Id');
    });
  });

  describe('persistedSignal signal value update policies depending on PersistenceProvider', () => {
    it('should update immediately if persistValue(...) does not return an observable', () => {
      const service = TestBed.inject(SyncSignalBucket);

      service.property1.set('secondValue');
      expect(service.property1()).toBe('secondValue');
      expect(localStorage.getItem('property1Id')).toBe('"secondValue"');
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

    });

    it('should receive updates from receiveSignal$ if it exists', () => {

    });
  });
});