import { TestBed } from '@angular/core/testing';

import { LocalStoragePersistence, SessionStoragePersistence } from './persistence-provider';

describe('Local/SessionStoragePersistence', () => {
  [
    { persistence: LocalStoragePersistence, storage: localStorage },
    { persistence: SessionStoragePersistence, storage: sessionStorage }
  ].forEach(testElement => {
    const storage = testElement.storage;
    const provider = testElement.persistence;

    describe(provider.name, () => {
      beforeEach(() => {
        storage.clear();
        TestBed.configureTestingModule({});
      });

      it('should be created', () => {
        const service = TestBed.inject(provider);
        expect(service).toBeTruthy();
      });

      describe('initialize(lookupIds: Iterable<string>): Observable<SerializedSignal>', () => {
        it('should complete the returned observable', (done) => {
          const service = TestBed.inject(provider);
          expect(service).toBeTruthy();
          service.initialize([]).subscribe({
            complete: () => {
              done();
            }
          });
        });

        it('should return the serialized values of the provided lookupIds that are persisted', (done) => {
          storage.setItem('id1', '"value1"');
          storage.setItem('id2', '"value2"');
          const service = TestBed.inject(provider);
          const receivedIds: string[] = [];
          service.initialize(['id1', 'id2']).subscribe({
            next: serializedSignal => receivedIds.push(serializedSignal.id),
            complete: () => {
              expect(receivedIds).toContain('id1');
              expect(receivedIds).toContain('id1');
              done();
            }
          });
        });

        it('should not return the serialized values of the provided lookupIds that are not persisted', (done) => {
          storage.setItem('id1', '"value1"');
          storage.setItem('id2', '"value2"');
          const service = TestBed.inject(provider);
          const receivedIds: string[] = [];
          service.initialize(['id2', 'id3']).subscribe({
            next: serializedSignal => receivedIds.push(serializedSignal.id),
            complete: () => {
              expect(receivedIds).not.toContain('id3');
              done();
            }
          });
        });

        it('should not return the serialized values of lookupIds that were not requested', (done) => {
          storage.setItem('id1', '"value1"');
          storage.setItem('id2', '"value2"');
          const service = TestBed.inject(provider);
          const receivedIds: string[] = [];
          service.initialize(['id2', 'id3']).subscribe({
            next: serializedSignal => receivedIds.push(serializedSignal.id),
            complete: () => {
              expect(receivedIds).not.toContain('id1');
              done();
            }
          });
        });
      });

      describe('persistValue(value: SerializedSignal)', () => {
        // this persistence provider works synchronous, so no need to return an observable
        it('should not return a value', () => {
          const service = TestBed.inject(provider);
          expect(service.persistValue({ id: 'id1', value: 1 })).toBeUndefined();
        });

        it('should persist the serialized value', () => {
          const service = TestBed.inject(provider);
          service.persistValue({ id: 'id1', value: 1 });
          expect(storage.getItem('id1')).toBe('1');
        });
      });
    });
  });
});
