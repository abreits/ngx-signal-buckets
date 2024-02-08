import { Injectable, Injector, OnDestroy, Type, WritableSignal, signal } from '@angular/core';
import { SIGNAL, SignalGetter, SignalNode, signalSetFn } from '@angular/core/primitives/signals';
import { toSignal } from '@angular/core/rxjs-interop';

import { deserialize, serialize } from 'ngx-simple-serializer';
import { create } from 'mutative';
import { Observable, Subject, Subscription, filter, from, map, mergeAll, mergeMap, tap } from 'rxjs';

import { LocalStoragePersistence } from './persistence-provider';
import { PersistenceProvider, SerializedSignal, persistedSignalOptions } from './types';


type ProviderConfig = { instance: PersistenceProvider, signals: Set<string> }

/**
 * Contains multiple `persistedSignals` that are persisted to `PersistenceProviders` as key-value pairs
 */
@Injectable()
export class SignalBucket implements OnDestroy {
  protected defaultPersistance = LocalStoragePersistence;
  protected prefix = '';
  private persistenceProviders = new Map<Type<PersistenceProvider>, ProviderConfig>();
  private signalNodes = new Map<string, SignalNode<any>>();
  private receiveSignalSubscription?: Subscription;

  constructor(
    private injector: Injector
  ) { }

  /**
   * Updates the persistedSignal properties with their current persisted values.
   * Calls `complete()` after updating all persisted values
   */
  initialize(complete?: () => void) {
    // collect and process incoming receiveSignal$ updates from the PersistenceProviders
    const receiveSignalProviders$ = new Subject<Observable<SerializedSignal>>();
    this.receiveSignalSubscription = receiveSignalProviders$.pipe(
      mergeAll(),
      tap(this.setSerializedValue)
    ).subscribe();

    // initialize PersistenceProviders used by the persistedSignal properties
    from(this.persistenceProviders.values()).pipe(
      tap(persistenceProvider => {
        if (persistenceProvider.instance.receiveSignal$) {
          receiveSignalProviders$.next(persistenceProvider.instance.receiveSignal$);
        }
      }),
      mergeMap(persistenceProvider => persistenceProvider.instance.initialize(persistenceProvider.signals.values())),
      tap(this.setSerializedValue)
    ).subscribe({ complete });
  }

  ngOnDestroy(): void {
    this.receiveSignalSubscription?.unsubscribe();
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
    let persistenceProvider: Type<PersistenceProvider> | undefined;

    if (typeof idOrOptions === 'string') {
      id = idOrOptions;
    } else {
      id = idOrOptions.id;
      persistenceProvider = idOrOptions.persistenceProvider;
    }

    if (this.signalNodes.has(id)) {
      throw new Error(`SignalBucket contains duplicate signal id: ${id}`);
    }

    const provider = this.getProviderConfig(persistenceProvider);

    let persistedSignal: SignalGetter<T> & WritableSignal<T>;
    if (provider.instance.receiveSignal$) {
      // process external signal updates from this observable if it exists
      const externalValue$ = provider.instance.receiveSignal$.pipe(
        filter(entry => entry.id === id),
        map(entry => deserialize(entry.serializedValue) as T)
      );
      persistedSignal = toSignal(externalValue$, { initialValue }) as SignalGetter<T> & WritableSignal<T>;
    } else {
      persistedSignal = signal(initialValue) as SignalGetter<T> & WritableSignal<T>;
    }

    const signalNode = persistedSignal[SIGNAL];
    provider.signals.add(id);
    this.signalNodes.set(id, signalNode);

    persistedSignal.set = (value: T) => {
      this.persistValue(id, value, signalNode, provider.instance);
    };
    persistedSignal.update = (updateFunction: (value: T) => void) => {
      const updatedValue = create(signalNode.value, updateFunction, { mark: () => 'immutable' });
      this.persistValue(id, updatedValue, signalNode, provider.instance);
    };
    return persistedSignal;
  }

  private getProviderConfig(persistenceProvider: Type<PersistenceProvider> = this.defaultPersistance): ProviderConfig {
    let provider = this.persistenceProviders.get(persistenceProvider);
    if (!provider) {
      provider = {
        instance: this.injector.get(persistenceProvider),
        signals: new Set<string>()
      };
      this.persistenceProviders.set(persistenceProvider, provider);
    }
    return provider;
  }

  private setSerializedValue = (serializedSignal: SerializedSignal) => {
    const signalNode = this.signalNodes.get(serializedSignal.id);
    if (signalNode) {
      signalSetFn(signalNode, deserialize(serializedSignal.serializedValue));
    }
  };

  private persistValue(id: string, value: any, signalNode: SignalNode<any>, instance: PersistenceProvider) {
    const serializedValue = serialize(value);
    if (instance.persistValue) {
      const persist$ = instance.persistValue({ id, serializedValue });
      if (persist$) {
        persist$.subscribe(persistedValue => {
          value = deserialize(persistedValue);
          signalSetFn(signalNode, value);
        });
      } else {
        signalSetFn(signalNode, value);
      }
    }
    instance.sendSignal$?.next({ id, serializedValue });
  }
}
