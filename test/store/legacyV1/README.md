# Frozen v1 compatibility fixture

Copied from MenuPilot commit `02c8d4be6ae814ac7f9938525c31d0e4aaed2ca0` (the base before step 2a).
`../legacyV1Store.js` and this directory contain the complete transitive module closure,
including the calculation helpers used by the old validator. No imports resolve to live `src/`.
Only import paths were adapted to this fixture directory. Do not modernize these modules:
they must continue to represent the actual old reader and writer.
