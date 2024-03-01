# Change Log

## 2.0.0
- BREAKING CHANGE: Changed `sendSignal$` Subject to a `sendSignal()` method in the PersistenceProvider interface.
  It reduces code compexity for a custom PersistenceProvider that uses it 
  (no need to cleanup a subscribed Subject any more)

## 1.0.0
- Initial public version
