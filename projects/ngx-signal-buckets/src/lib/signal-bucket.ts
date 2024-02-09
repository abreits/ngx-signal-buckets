import { Injectable, Injector, Type, WritableSignal, signal } from '@angular/core';
import { SIGNAL, SignalGetter, SignalNode, signalSetFn } from '@angular/core/primitives/signals';
import { toSignal } from '@angular/core/rxjs-interop';

import { deserialize, serialize } from 'ngx-simple-serializer';
import { create } from 'mutative';
import { PartialObserver, filter, from, map, mergeMap, tap } from 'rxjs';

import { LocalStoragePersistence } from './persistence-provider';
import { PersistenceProvider, SerializedSignal, persistedSignalOptions } from './types';


type ProviderConfig = { instance: PersistenceProvider, signalIds: Set<string> }

/**
 * Contains multiple `persistedSignals` that are persisted to `PersistenceProviders` as key-value pairs
 */
@Injectable()
export class SignalBucket {
  protected defaultPersistence: Type<PersistenceProvider> = LocalStoragePersistence;
  protected prefix = '';
  private persistenceProviders = new Map<Type<PersistenceProvider>, ProviderConfig>();
  private signalNodes = new Map<string, SignalNode<any>>();
  private initialized = false;

  constructor(
    private injector: Injector
  ) { }

  /**
   * Updates the persistedSignal properties with their current persisted values.
   * Calls `complete()` after updating all persisted values
   */
  initialize(completeOrObserver?: (() => void) | PartialObserver<any>) {
    if (this.initialized) {
      throw new Error('SignalBucket already initialized, initialize should only be called once');
    }
    if (typeof completeOrObserver === 'function') {
      completeOrObserver = { complete: completeOrObserver };
    }
    from(this.persistenceProviders.values()).pipe(
      mergeMap(persistenceProvider => persistenceProvider.instance.initialize(persistenceProvider.signalIds.values())),
      tap(this.setSerializedValue)
    ).subscribe(completeOrObserver);
    this.initialized = true;
  }

  /**
   * Create a persisted signal.
   * 
   * A persisted signal needs an initial value and a unique id to persist its value.
   * 
   * A persisted signal uses the `defaultPersistence` persistence provider, 
   * unless another persistence provider is defined in the options.
   */
  persistedSignal<T>(initialValue: T, id: string): WritableSignal<T>;
  persistedSignal<T>(initialValue: T, options: persistedSignalOptions): WritableSignal<T>;
  persistedSignal<T>(initialValue: T, idOrOptions: string | persistedSignalOptions): WritableSignal<T> {
    let id: string;
    let persistenceClass: Type<PersistenceProvider> | undefined;
    if (typeof idOrOptions === 'string') {
      id = idOrOptions;
    } else {
      id = idOrOptions.id;
      persistenceClass = idOrOptions.persistenceProvider;
    }
    if (this.signalNodes.has(id)) {
      throw new Error(`SignalBucket contains duplicate persistedSignal id: ${id}`);
    }
    const providerConfig = this.getProviderConfig(persistenceClass);
    let persistedSignal: SignalGetter<T> & WritableSignal<T>;
    if (providerConfig.instance.receiveSignal$) {
      // process external signal updates from this observable if it exists
      const externalValue$ = providerConfig.instance.receiveSignal$.pipe(
        filter(entry => entry.id === id),
        map(entry => deserialize(entry.serializedValue) as T)
      );
      persistedSignal = toSignal(externalValue$, { initialValue }) as SignalGetter<T> & WritableSignal<T>;
    } else {
      persistedSignal = signal(initialValue) as SignalGetter<T> & WritableSignal<T>;
    }
    const signalNode = persistedSignal[SIGNAL];
    providerConfig.signalIds.add(id);
    this.signalNodes.set(id, signalNode);
    persistedSignal.set = (value: T) => {
      this.persistValue(id, value, signalNode, providerConfig.instance);
    };
    persistedSignal.update = (updateFunction: (value: T) => void) => {
      const updatedValue = create(signalNode.value, updateFunction, { mark: () => 'immutable' });
      this.persistValue(id, updatedValue, signalNode, providerConfig.instance);
    };
    return persistedSignal;
  }

  private getProviderConfig(persistenceClass: Type<PersistenceProvider> = this.defaultPersistence): ProviderConfig {
    let provider = this.persistenceProviders.get(persistenceClass);
    if (!provider) {
      provider = {
        instance: this.injector.get(persistenceClass),
        signalIds: new Set<string>()
      };
      this.persistenceProviders.set(persistenceClass, provider);
    }
    return provider;
  }

  private setSerializedValue = (serializedSignal: SerializedSignal) => {
    const signalNode = this.signalNodes.get(serializedSignal.id);
    if (signalNode) {
      signalSetFn(signalNode, deserialize(serializedSignal.serializedValue));
    }
  };

  private persistValue(id: string, value: any, signalNode: SignalNode<any>, persistenceProvider: PersistenceProvider) {
    const serializedValue = serialize(value);
    if (persistenceProvider.persistValue) {
      const persist$ = persistenceProvider.persistValue({ id, serializedValue });
      if (persist$) {
        persist$.subscribe(persistedValue => {
          value = deserialize(persistedValue);
          signalSetFn(signalNode, value);
        });
      } else {
        signalSetFn(signalNode, value);
      }
    }
    persistenceProvider.sendSignal$?.next({ id, serializedValue });
  }
}
