import { Injectable } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { Observable, delay } from 'rxjs';

import { SignalBucket } from './signal-bucket';
import { LocalStoragePersistence } from './persistence-provider';
import { SerializedSignal } from './types';

@Injectable({ providedIn: 'root' })
export class AsyncLocalStoragePersistence extends LocalStoragePersistence {
  override initialize(lookupIds: Iterable<string>): Observable<SerializedSignal> {
    return super.initialize(lookupIds).pipe(
      delay(1)
    );
  }
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
    persistenceProvider: AsyncLocalStoragePersistence
  });
  property3 = this.persistedSignal('initialValue3', 'property3Id');
}

@Injectable({ providedIn: 'root' })
class DuplicateIdSignalBucket extends SignalBucket {
  property1 = this.persistedSignal('initialValue', 'property1Id');
  property1too = this.persistedSignal('initialValue', 'property1Id');
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

    fit('should call the supplied complete() function after initialization is complete, sync and async PersistenceProviders', (done) => {
      const service = TestBed.inject(SyncAsyncSignalBucket);
      localStorage.setItem('property1Id', '"persistedValue"');
      localStorage.setItem('property2Id', '"persistedValue2"');
      localStorage.setItem('property3Id', '"persistedValue3"');
      expect(service.property1()).toBe('initialValue');
      expect(service.property2()).toBe('initialValue2');
      expect(service.property3()).toBe('initialValue3');

      service.initialize(() => {
        // expected all signal values to be updated
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
});