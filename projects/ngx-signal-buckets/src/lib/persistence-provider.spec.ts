import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { LocalStoragePersistence, ServerPersistence, SessionStoragePersistence } from './persistence-provider';

describe('LocalStoragePersistence', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    const service = TestBed.inject(LocalStoragePersistence);
    expect(service).toBeTruthy();
  });
});

describe('SessionStoragePersistence', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    const service = TestBed.inject(SessionStoragePersistence);
    expect(service).toBeTruthy();
  });
});

describe('ServerPersistence', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
      ]
    });
  });

  it('should be created', () => {
    const service = TestBed.inject(ServerPersistence);
    expect(service).toBeTruthy();
  });
});